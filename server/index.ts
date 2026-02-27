import { EventStore } from "./event-store.ts";
import { AcpBridge, formatError } from "./acp-bridge.ts";
import { createDispatch, getServerEpoch } from "./dispatch.ts";
import type { WsCommand, DomainEvent, WsEvent } from "./types.ts";
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

const store = new EventStore();

// Read models (projections)
const sessionRegistry = createSessionRegistry(store);
const latestSession = createLatestSessionProjection(store);
const metaContextRegistry = createMetaContextRegistry(store, CWD);

// Create dispatch (bridge injected lazily after construction)
const dispatch = createDispatch(store, sessionRegistry, metaContextRegistry);

// Create bridge with dispatch + store, then wire it into dispatch
const bridge = new AcpBridge(CWD, store, dispatch);
dispatch.setBridge(bridge);

const SERVER_EPOCH = getServerEpoch();

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
      console.warn(`[drainReplayQueue] DROPPED event, aborting queue (${wsState.replayQueue.length} remaining)`);
      wsState.replayQueue.length = 0;
      wsState.draining = false;
      return;
    }

    if (result === -1) {
      wsState.draining = true;
      return;
    }

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
  const wsState = wsStates.get(ws);
  if (wsState?.draining) {
    wsState.replayQueue.push(event);
    return;
  }

  try {
    const bws = ws as { send(data: string): number; cork(cb: () => void): void };
    const data = JSON.stringify(event);
    let result = 0;
    bws.cork(() => { result = bws.send(data); });
    if (result === 0) {
      console.warn(`[sendWs] DROPPED ${event.type} (seq=${"seq" in event ? event.seq : "?"})`);
    } else if (result === -1) {
      if (wsState) {
        wsState.draining = true;
      }
    }
  } catch (err) {
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

  if (state.unsubscribe) {
    state.unsubscribe();
  }

  state.currentSessionId = sessionId;

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

      sendWs(ws, buildSessionList(sessionRegistry, metaContextRegistry));

      if (latestSpecListEvent) sendWs(ws, latestSpecListEvent);
      if (latestGitStatusEvent) sendWs(ws, latestGitStatusEvent);
      if (latestServiceStatusEvent) sendWs(ws, latestServiceStatusEvent);

      const requested = ws.data.requestedSessionId;
      const validRequested = requested && sessionRegistry.getState().sessions.has(requested)
        ? requested
        : null;
      const latestId = latestSession.getState().latestSessionId;
      const latestMeta = latestId ? sessionRegistry.getState().sessions.get(latestId) : undefined;
      const fallbackSessionId = latestMeta?.loaded ? latestId : null;
      const targetSessionId = validRequested ?? fallbackSessionId;

      if (targetSessionId) {
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
          dispatch(targetSessionId, { type: "LoadSession" }).then(() => {
            switchAndReplay();
          }).catch((err) => {
            console.error(`Failed to load session ${targetSessionId} on connect:`, err);
            switchAndReplay();
          });
        } else {
          switchAndReplay();
        }
      }
    },

    async message(ws, message) {
      try {
        const cmd = JSON.parse(String(message)) as WsCommand;
        const wsState = wsStates.get(ws);

        switch (cmd.command) {
          case "submit_prompt": {
            const sessionId = wsState?.currentSessionId;
            if (!sessionId) {
              sendWs(ws, {
                type: "ErrorOccurred",
                message: "No active session",
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
              return;
            }
            await dispatch(sessionId, { type: "SubmitPrompt", text: cmd.text, images: cmd.images });
            break;
          }

          case "cancel": {
            const sessionId = wsState?.currentSessionId;
            if (sessionId) {
              await dispatch(sessionId, { type: "CancelPrompt" });
            }
            break;
          }

          case "create_session": {
            await dispatch("_", { type: "CreateSession" });
            // The AutoSwitchAfterCreate processor emits SessionSwitched,
            // which the WS subscription picks up. The WS open handler on
            // the *next* connect will subscribe to that session.
            // For the current connection, we need to subscribe manually.
            // We find the latest created session from the registry.
            const latest = latestSession.getState().latestSessionId;
            if (latest) {
              subscribeWsToSession(ws, latest);
              replaySession(ws, latest);
            }
            break;
          }

          case "switch_session": {
            const targetId = cmd.sessionId;
            // Dispatch SwitchSession — this validates, emits SessionSwitched,
            // and triggers LoadIfUnloaded processor if needed
            await dispatch(targetId, { type: "SwitchSession" });

            // Subscribe this WS connection to the new session and replay
            subscribeWsToSession(ws, targetId);
            replaySession(ws, targetId);
            break;
          }

          case "next_block_click": {
            const currentSessionId = wsState?.currentSessionId;
            if (!currentSessionId) {
              sendWs(ws, {
                type: "ErrorOccurred",
                message: "No active session",
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
              return;
            }
            await dispatch(currentSessionId, {
              type: "NextBlockClick",
              currentSessionId,
              label: cmd.label,
              commandText: cmd.commandText,
              metaContext: cmd.metaContext,
            });
            // The pipeline creates a new session — subscribe to it
            const latest = latestSession.getState().latestSessionId;
            if (latest && latest !== currentSessionId) {
              subscribeWsToSession(ws, latest);
              replaySession(ws, latest);
            }
            break;
          }

          default:
            sendWs(ws, {
              type: "ErrorOccurred",
              message: `Unknown command: ${(cmd as { command: string }).command}`,
              seq: -1,
              timestamp: Date.now(),
              sessionId: "",
            });
        }
      } catch (err) {
        sendWs(ws, {
          type: "ErrorOccurred",
          message: `Invalid command: ${formatError(err)}`,
          seq: -1,
          timestamp: Date.now(),
          sessionId: "",
        });
      }
    },

    drain(ws) {
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

// Graceful shutdown
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
  runStartHook(CWD);

  // Discover existing sessions from the ACP agent
  const existing = await bridge.listSessions();
  const now = Date.now();
  for (let i = 0; i < existing.length; i++) {
    const s = existing[i];
    const name = s.title || `Session ${i + 1}`;
    await dispatch(s.sessionId, {
      type: "DiscoverSession",
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
    await dispatch("_", { type: "CreateSession" });
  } catch (err) {
    console.error("Failed to create initial session:", err);
  }

  broadcastSessionList();
}).catch((err) => {
  console.error("Failed to start ACP bridge:", err);
  store.append("__error__", {
    type: "ErrorOccurred",
    message: `ACP bridge failed to start: ${formatError(err)}`,
  });
});
