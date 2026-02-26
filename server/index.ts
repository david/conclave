import { EventStore } from "./event-store.ts";
import { AcpBridge, formatError } from "./acp-bridge.ts";
import type { Command, DomainEvent, WsEvent } from "./types.ts";
import { join } from "path";
import { createSessionRegistry } from "./projections/session-registry.ts";
import { createLatestSessionProjection } from "./projections/latest-session.ts";
import { createSessionListProjection, buildSessionList } from "./projections/session-list.ts";
import { createMetaContextRegistry } from "./projections/meta-context-registry.ts";
import { scanSpecs } from "./spec-scanner.ts";
import { watchSpecs } from "./spec-watcher.ts";
import { startGitStatusPoller } from "./git-status-poller.ts";
import { startServiceStatusPoller } from "./service-status-poller.ts";
import { runStartHook } from "./start-hook.ts";

// Pluggable static asset handler — set via setStaticAssetHandler() by compile.ts for embedded assets
let serveStaticAsset: ((pathname: string) => Response | null) | null = null;
export function setStaticAssetHandler(handler: (pathname: string) => Response | null) {
  serveStaticAsset = handler;
}

const PORT = Number(process.env.PORT) || 9999;
const CWD = process.env.CONCLAVE_CWD || process.cwd();
const TLS_CERT = process.env.CONCLAVE_TLS_CERT || null;
const TLS_KEY = process.env.CONCLAVE_TLS_KEY || null;

// Unique identifier for this server process lifetime.
// Used by clients to detect server restarts and know when a full replay is needed
// vs. a delta catch-up.
const SERVER_EPOCH = crypto.randomUUID();

const store = new EventStore();

// Read models (projections)
const sessionRegistry = createSessionRegistry(store);
const latestSession = createLatestSessionProjection(store);
const metaContextRegistry = createMetaContextRegistry(store, CWD);

// Per-WS state (connection infrastructure — not domain state)
export type WsState = {
  currentSessionId: string | null;
  unsubscribe: (() => void) | null;
  /** Queued events waiting to be sent after backpressure drains */
  replayQueue: WsEvent[];
  /** Whether this connection is currently paused due to backpressure */
  draining: boolean;
};
const wsStates = new Map<object, WsState>();

/**
 * Drain the replay queue for a WS connection. Called both after initial
 * backpressure detection and from the WebSocket `drain` callback.
 * Sends events until the queue is empty or backpressure recurs.
 */
function drainReplayQueue(ws: object) {
  const wsState = wsStates.get(ws);
  if (!wsState || wsState.replayQueue.length === 0) {
    if (wsState) wsState.draining = false;
    return;
  }

  const bws = ws as { send(data: string): number; cork(cb: () => void): void };

  while (wsState.replayQueue.length > 0) {
    const event = wsState.replayQueue[0];
    const data = JSON.stringify(event);
    let result = 0;
    try {
      bws.cork(() => { result = bws.send(data); });
    } catch (err) {
      console.warn(`[drainReplayQueue] EXCEPTION: ${err}`);
      if (wsState.unsubscribe) wsState.unsubscribe();
      wsStates.delete(ws);
      return;
    }

    if (result === 0) {
      // Message dropped — connection gone, stop trying
      console.warn(`[drainReplayQueue] DROPPED event, aborting queue (${wsState.replayQueue.length} remaining)`);
      wsState.replayQueue.length = 0;
      wsState.draining = false;
      return;
    }

    if (result === -1) {
      // Backpressure — leave event in queue, wait for drain callback
      wsState.draining = true;
      return;
    }

    // Success — remove from queue and continue
    wsState.replayQueue.shift();
  }

  wsState.draining = false;
}

// Track latest SpecListUpdated for replay on WS connect, and broadcast to all clients
let latestSpecListEvent: DomainEvent | null = null;
{
  let pending: DomainEvent[] = [];
  let flushScheduled = false;
  store.subscribe((event) => {
    if (event.type === "SpecListUpdated") {
      latestSpecListEvent = event;
      pending.push(event);
      if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(() => {
          const batch = pending;
          pending = [];
          flushScheduled = false;
          for (const e of batch) {
            for (const [ws] of wsStates) {
              sendWs(ws, e);
            }
          }
        }, 0);
      }
    }
  });
}

// Track latest GitStatusUpdated for replay on WS connect, and broadcast to all clients
let latestGitStatusEvent: DomainEvent | null = null;
{
  let pending: DomainEvent[] = [];
  let flushScheduled = false;
  store.subscribe((event) => {
    if (event.type === "GitStatusUpdated") {
      latestGitStatusEvent = event;
      pending.push(event);
      if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(() => {
          const batch = pending;
          pending = [];
          flushScheduled = false;
          for (const e of batch) {
            for (const [ws] of wsStates) {
              sendWs(ws, e);
            }
          }
        }, 0);
      }
    }
  });
}

// Track latest ServiceStatusUpdated for replay on WS connect, and broadcast to all clients
let latestServiceStatusEvent: DomainEvent | null = null;
{
  let pending: DomainEvent[] = [];
  let flushScheduled = false;
  store.subscribe((event) => {
    if (event.type === "ServiceStatusUpdated") {
      latestServiceStatusEvent = event;
      pending.push(event);
      if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(() => {
          const batch = pending;
          pending = [];
          flushScheduled = false;
          for (const e of batch) {
            for (const [ws] of wsStates) {
              sendWs(ws, e);
            }
          }
        }, 0);
      }
    }
  });
}

const bridge = new AcpBridge(CWD, (sessionId, payload) => {
  // Skip system-level errors without a real session
  if (sessionId === "__system__") {
    console.error("System error:", (payload as { message?: string }).message);
    return;
  }

  store.append(sessionId, payload);
});

// Reactive session list broadcast — triggers whenever a session-affecting event lands
function broadcastSessionList() {
  const event = buildSessionList(sessionRegistry, metaContextRegistry);
  for (const [ws] of wsStates) {
    sendWs(ws, event);
  }
}

createSessionListProjection(store, sessionRegistry, () => {
  broadcastSessionList();
}, metaContextRegistry);

export function sendWs(ws: object, event: WsEvent) {
  // If this connection is draining from a replay, queue the event instead
  // of sending directly — this preserves ordering.
  const wsState = wsStates.get(ws);
  if (wsState?.draining) {
    wsState.replayQueue.push(event);
    return;
  }

  try {
    const bws = ws as { send(data: string): number; cork(cb: () => void): void };
    const data = JSON.stringify(event);
    let result = 0;
    // cork() ensures the write is flushed to the wire immediately.
    // Without it, sends from outside WebSocket handler callbacks (open/message/drain)
    // — such as those triggered by ACP event-store listeners — can sit in
    // uWebSockets' internal buffer until the next socket activity.
    bws.cork(() => { result = bws.send(data); });
    if (result === 0) {
      console.warn(`[sendWs] DROPPED ${event.type} (seq=${"seq" in event ? event.seq : "?"})`);
    } else if (result === -1) {
      // Backpressure from a non-replay send — queue any subsequent events
      if (wsState) {
        wsState.draining = true;
      }
    }
  } catch (err) {
    // Connection already closed — clean up
    console.warn(`[sendWs] EXCEPTION sending ${event.type}: ${err}`);
    const wsState = wsStates.get(ws);
    if (wsState?.unsubscribe) wsState.unsubscribe();
    wsStates.delete(ws);
  }
}

export function subscribeWsToSession(
  ws: object,
  sessionId: string,
  storeArg: EventStore = store,
  wsStatesArg: Map<object, WsState> = wsStates,
) {
  const state = wsStatesArg.get(ws);
  if (!state) return;

  // Unsubscribe from previous
  if (state.unsubscribe) {
    state.unsubscribe();
  }

  state.currentSessionId = sessionId;

  // Subscribe with session filter — batch events and flush asynchronously
  // via setTimeout(fn, 0) to break the microtask chain that starves
  // uWebSockets' IO loop during burst ACP processing.
  let pending: DomainEvent[] = [];
  let flushScheduled = false;
  state.unsubscribe = storeArg.subscribe((event: DomainEvent) => {
    if ("sessionId" in event && event.sessionId === sessionId) {
      pending.push(event);
      if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(() => {
          const batch = pending;
          pending = [];
          flushScheduled = false;
          for (const e of batch) sendWs(ws, e);
        }, 0);
      }
    }
  });
}

function replaySession(ws: object, sessionId: string, afterSeq = 0) {
  const allEvents = store.getBySessionId(sessionId);
  const events = afterSeq > 0 ? allEvents.filter(e => e.seq > afterSeq) : allEvents;
  console.log(`[replaySession] sessionId=${sessionId}, afterSeq=${afterSeq}, total=${allEvents.length}, sending=${events.length}`);

  if (events.length === 0) return;

  const wsState = wsStates.get(ws);
  if (!wsState) return;

  // Push all replay events into the queue and drain what we can immediately.
  // If backpressure hits, the drain callback will resume sending.
  wsState.replayQueue.push(...events);
  drainReplayQueue(ws);
}

type WsData = {
  requestedSessionId: string | null;
  clientEpoch: string | null;
  lastSeq: number;
};

const server = Bun.serve<WsData>({
  port: PORT,
  ...(TLS_CERT && TLS_KEY ? {
    tls: {
      cert: Bun.file(TLS_CERT),
      key: Bun.file(TLS_KEY),
    },
  } : {}),

  async fetch(req) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const requestedSessionId = url.searchParams.get("sessionId") || null;
      const clientEpoch = url.searchParams.get("epoch") || null;
      const lastSeq = Number(url.searchParams.get("lastSeq")) || 0;
      const upgraded = server.upgrade(req, { data: { requestedSessionId, clientEpoch, lastSeq } });
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Try embedded assets first (compiled binary), then fall back to dist/ on disk
    if (serveStaticAsset) {
      const embedded = serveStaticAsset(url.pathname);
      if (embedded) return embedded;

      // SPA fallback
      if (url.pathname.startsWith("/session/")) {
        const fallback = serveStaticAsset("/index.html");
        if (fallback) return fallback;
      }

      return new Response("Not found", { status: 404 });
    }

    // Development: serve from dist/ on disk
    const distDir = join(import.meta.dir, "..", "dist");
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(distDir, filePath));

    if (await file.exists()) {
      return new Response(file, {
        headers: { "Cache-Control": "no-cache" },
      });
    }

    // SPA fallback: serve index.html for /session/* routes
    if (url.pathname.startsWith("/session/")) {
      return new Response(Bun.file(join(distDir, "index.html")), {
        headers: { "Cache-Control": "no-cache" },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      const isDelta = ws.data.clientEpoch === SERVER_EPOCH && ws.data.lastSeq > 0;
      console.log(`WS connected (${isDelta ? "delta" : "full"} replay${ws.data.requestedSessionId ? `, session=${ws.data.requestedSessionId}` : ""})`);
      wsStates.set(ws, { currentSessionId: null, unsubscribe: null, replayQueue: [], draining: false });

      // Send session list
      sendWs(ws, buildSessionList(sessionRegistry, metaContextRegistry));

      // Send latest spec list if available
      if (latestSpecListEvent) {
        sendWs(ws, latestSpecListEvent);
      }

      // Send latest git status if available
      if (latestGitStatusEvent) {
        sendWs(ws, latestGitStatusEvent);
      }

      // Send latest service status if available
      if (latestServiceStatusEvent) {
        sendWs(ws, latestServiceStatusEvent);
      }

      // Determine which session to replay: prefer URL-requested, fall back to latest loaded session.
      // Discovered-but-not-loaded sessions are excluded from auto-routing because they may
      // belong to a previous ACP subprocess and fail to load.
      const requested = ws.data.requestedSessionId;
      const validRequested = requested && sessionRegistry.getState().sessions.has(requested)
        ? requested
        : null;
      const latestId = latestSession.getState().latestSessionId;
      const latestMeta = latestId ? sessionRegistry.getState().sessions.get(latestId) : undefined;
      const fallbackSessionId = latestMeta?.loaded ? latestId : null;
      const targetSessionId = validRequested ?? fallbackSessionId;

      if (targetSessionId) {
        // Delta reconnect: same server epoch, same session, client has prior state.
        // Skip SessionSwitched (client already has this session) and only send new events.
        const isDeltaReconnect =
          isDelta && targetSessionId === ws.data.requestedSessionId;

        const switchAndReplay = () => {
          if (isDeltaReconnect) {
            subscribeWsToSession(ws, targetSessionId);
            replaySession(ws, targetSessionId, ws.data.lastSeq);
          } else {
            sendWs(ws, {
              type: "SessionSwitched",
              sessionId: targetSessionId,
              seq: -1,
              timestamp: Date.now(),
              epoch: SERVER_EPOCH,
            } as any);
            subscribeWsToSession(ws, targetSessionId);
            replaySession(ws, targetSessionId);
          }
        };

        // Load discovered-but-not-loaded sessions before replaying
        const meta = sessionRegistry.getState().sessions.get(targetSessionId);
        if (meta && !meta.loaded) {
          bridge.loadSession(targetSessionId).then(() => {
            store.append(targetSessionId, { type: "TurnCompleted", stopReason: "end_turn" });
            store.append(targetSessionId, { type: "SessionLoaded" });
            switchAndReplay();
          }).catch((err) => {
            console.error(`Failed to load session ${targetSessionId} on connect:`, err);
            // Still switch to the session so the client isn't stuck
            switchAndReplay();
          });
        } else {
          switchAndReplay();
        }
      }
    },

    async message(ws, message) {
      try {
        const cmd = JSON.parse(String(message)) as Command;
        const wsState = wsStates.get(ws);

        switch (cmd.command) {
          case "submit_prompt": {
            const sessionId = wsState?.currentSessionId;
            if (!sessionId) {
              sendWs(ws, {
                type: "Error",
                message: "No active session",
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
              return;
            }

            // Load discovered-but-not-loaded sessions before prompting
            const meta = sessionRegistry.getState().sessions.get(sessionId);
            if (meta && !meta.loaded) {
              try {
                await bridge.loadSession(sessionId);
                store.append(sessionId, { type: "TurnCompleted", stopReason: "end_turn" });
                store.append(sessionId, { type: "SessionLoaded" });
              } catch (err) {
                sendWs(ws, {
                  type: "Error",
                  message: `Failed to load session: ${formatError(err)}`,
                  seq: -1,
                  timestamp: Date.now(),
                  sessionId: "",
                });
                return;
              }
            }

            // Emit PromptSubmitted with the user text
            store.append(sessionId, { type: "PromptSubmitted", text: cmd.text, images: cmd.images });
            bridge.submitPrompt(sessionId, cmd.text, cmd.images, true);
            break;
          }

          case "cancel": {
            const sessionId = wsState?.currentSessionId;
            if (sessionId) {
              bridge.cancel(sessionId);
            }
            break;
          }

          case "create_session": {
            try {
              const sessionId = await bridge.createSession();
              store.append(sessionId, { type: "SessionCreated" });

              // Switch this client to the new session
              sendWs(ws, {
                type: "SessionSwitched",
                sessionId,
                seq: -1,
                timestamp: Date.now(),
                epoch: SERVER_EPOCH,
              } as any);
              subscribeWsToSession(ws, sessionId);

              // Replay the new session (has SessionCreated)
              replaySession(ws, sessionId);
            } catch (err) {
              sendWs(ws, {
                type: "Error",
                message: `Failed to create session: ${formatError(err)}`,
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
            }
            break;
          }

          case "switch_session": {
            const targetId = cmd.sessionId;
            const targetMeta = sessionRegistry.getState().sessions.get(targetId);
            if (!targetMeta) {
              sendWs(ws, {
                type: "Error",
                message: `Session not found: ${targetId}`,
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
              return;
            }

            // Load the session from ACP if not yet loaded (replays history via sessionUpdate notifications)
            if (!targetMeta.loaded) {
              try {
                await bridge.loadSession(targetId);
                // Append a synthetic TurnCompleted so the client's isProcessing settles to false
                store.append(targetId, { type: "TurnCompleted", stopReason: "end_turn" });
                store.append(targetId, { type: "SessionLoaded" });
              } catch (err) {
                sendWs(ws, {
                  type: "Error",
                  message: `Failed to load session: ${formatError(err)}`,
                  seq: -1,
                  timestamp: Date.now(),
                  sessionId: "",
                });
                return;
              }
            }

            // Send SessionSwitched, then replay stored events
            sendWs(ws, {
              type: "SessionSwitched",
              sessionId: targetId,
              seq: -1,
              timestamp: Date.now(),
              epoch: SERVER_EPOCH,
            } as any);
            subscribeWsToSession(ws, targetId);
            replaySession(ws, targetId);
            break;
          }

          case "next_block_click": {
            const currentSessionId = wsState?.currentSessionId;
            if (!currentSessionId) {
              sendWs(ws, {
                type: "Error",
                message: "No active session",
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
              return;
            }

            try {
              const metaContextName = cmd.metaContext;
              const mcState = metaContextRegistry.getState();
              let metaContextId = mcState.nameIndex.get(metaContextName);

              // If meta-context doesn't exist, create it
              if (!metaContextId) {
                metaContextId = crypto.randomUUID();
                store.append(currentSessionId, {
                  type: "MetaContextCreated",
                  metaContextId,
                  name: metaContextName,
                });
              }

              // Create a new ACP session
              const newSessionId = await bridge.createSession();
              store.append(newSessionId, { type: "SessionCreated" });

              // Add the new session to the meta-context
              store.append(newSessionId, {
                type: "SessionAddedToMetaContext",
                metaContextId,
              });

              // Switch this client to the new session
              sendWs(ws, {
                type: "SessionSwitched",
                sessionId: newSessionId,
                seq: -1,
                timestamp: Date.now(),
                epoch: SERVER_EPOCH,
              } as any);
              subscribeWsToSession(ws, newSessionId);
              replaySession(ws, newSessionId);

              // Submit the prompt
              store.append(newSessionId, { type: "PromptSubmitted", text: cmd.commandText });
              bridge.submitPrompt(newSessionId, cmd.commandText, undefined, true);
            } catch (err) {
              sendWs(ws, {
                type: "Error",
                message: `Failed to handle next block click: ${formatError(err)}`,
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
            }
            break;
          }

          default:
            sendWs(ws, {
              type: "Error",
              message: `Unknown command: ${(cmd as { command: string }).command}`,
              seq: -1,
              timestamp: Date.now(),
              sessionId: "",
            });
        }
      } catch (err) {
        sendWs(ws, {
          type: "Error",
          message: `Invalid command: ${formatError(err)}`,
          seq: -1,
          timestamp: Date.now(),
          sessionId: "",
        });
      }
    },

    drain(ws) {
      // uWebSockets calls drain when backpressure has subsided.
      // Resume sending queued replay/live events.
      drainReplayQueue(ws);
    },

    close(ws) {
      const wsState = wsStates.get(ws);
      if (wsState) {
        if (wsState.unsubscribe) wsState.unsubscribe();
        wsState.replayQueue.length = 0;
      }
      wsStates.delete(ws);
    },
  },
});

const protocol = TLS_CERT && TLS_KEY ? "https" : "http";
console.log(`Conclave server listening on ${protocol}://localhost:${PORT}`);

// Graceful shutdown — clean up child processes, timers, and the HTTP server
let stopSpecWatcher: (() => void) | null = null;
let stopGitPoller: (() => void) | null = null;
let stopServicePoller: (() => void) | null = null;

function shutdown() {
  console.log("Shutting down...");
  server.stop();
  bridge.stop();
  if (stopSpecWatcher) stopSpecWatcher();
  if (stopGitPoller) stopGitPoller();
  if (stopServicePoller) stopServicePoller();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the ACP bridge, discover existing sessions, then create one if needed
bridge.start().then(async () => {
  // Run start hook (fire-and-forget) before session discovery
  runStartHook(CWD);

  // Discover existing sessions from the ACP agent
  const existing = await bridge.listSessions();
  const now = Date.now();
  for (let i = 0; i < existing.length; i++) {
    const s = existing[i];
    const name = s.title || `Session ${i + 1}`;
    store.append(s.sessionId, {
      type: "SessionDiscovered",
      name,
      title: s.title ?? null,
      createdAt: now - i,
    });
  }

  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing session(s), latest: ${latestSession.getState().latestSessionId}`);
  }

  // Scan specs directory and emit initial spec list, then watch for changes
  const specsDir = join(CWD, ".conclave", "specs");
  try {
    const specs = await scanSpecs(specsDir);
    store.appendGlobal({ type: "SpecListUpdated", specs });
    if (specs.length > 0) {
      console.log(`Found ${specs.length} spec(s)`);
    }
    stopSpecWatcher = watchSpecs(specsDir, (updatedSpecs) => {
      store.appendGlobal({ type: "SpecListUpdated", specs: updatedSpecs });
    });
  } catch (err) {
    console.error("Failed to scan specs:", err);
  }

  // Start git status poller
  const gitPoller = startGitStatusPoller({
    cwd: CWD,
    intervalMs: 3000,
    onUpdate: (files) => {
      store.appendGlobal({ type: "GitStatusUpdated", files });
    },
  });
  stopGitPoller = gitPoller.stop;

  // Start service status poller
  const servicePoller = startServiceStatusPoller({
    apiUrl: "http://localhost:8080/processes",
    intervalMs: 5000,
    onUpdate: (available, services) => {
      store.appendGlobal({ type: "ServiceStatusUpdated", available, services });
    },
  });
  stopServicePoller = servicePoller.stop;

  // Always create a fresh session to start with
  try {
    const sessionId = await bridge.createSession();
    store.append(sessionId, { type: "SessionCreated" });
  } catch (err) {
    console.error("Failed to create initial session:", err);
  }

  broadcastSessionList();
}).catch((err) => {
  console.error("Failed to start ACP bridge:", err);
  store.append("__error__", {
    type: "Error",
    message: `ACP bridge failed to start: ${formatError(err)}`,
  });
});
