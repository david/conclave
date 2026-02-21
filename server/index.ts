import { EventStore } from "./event-store.ts";
import { AcpBridge, formatError } from "./acp-bridge.ts";
import type { Command, DomainEvent, WsEvent } from "./types.ts";
import { join } from "path";
import { createSessionRegistry } from "./projections/session-registry.ts";
import { createLatestSessionProjection } from "./projections/latest-session.ts";
import { createSessionListProjection, buildSessionList } from "./projections/session-list.ts";
import { scanSpecs } from "./spec-scanner.ts";
import { watchSpecs } from "./spec-watcher.ts";
import { startGitStatusPoller } from "./git-status-poller.ts";

// Pluggable static asset handler — set via setStaticAssetHandler() by compile.ts for embedded assets
let serveStaticAsset: ((pathname: string) => Response | null) | null = null;
export function setStaticAssetHandler(handler: (pathname: string) => Response | null) {
  serveStaticAsset = handler;
}

const PORT = Number(process.env.PORT) || 3000;
const CWD = process.env.CONCLAVE_CWD || process.cwd();

const store = new EventStore();

// Read models (projections)
const sessionRegistry = createSessionRegistry(store);
const latestSession = createLatestSessionProjection(store);

// Per-WS state (connection infrastructure — not domain state)
type WsState = { currentSessionId: string | null; unsubscribe: (() => void) | null };
const wsStates = new Map<object, WsState>();

// Track latest SpecListUpdated for replay on WS connect, and broadcast to all clients
let latestSpecListEvent: DomainEvent | null = null;
store.subscribe((event) => {
  if (event.type === "SpecListUpdated") {
    latestSpecListEvent = event;
    // Broadcast to all connected clients
    for (const [ws] of wsStates) {
      sendWs(ws, event);
    }
  }
});

// Track latest GitStatusUpdated for replay on WS connect, and broadcast to all clients
let latestGitStatusEvent: DomainEvent | null = null;
store.subscribe((event) => {
  if (event.type === "GitStatusUpdated") {
    latestGitStatusEvent = event;
    // Broadcast to all connected clients
    for (const [ws] of wsStates) {
      sendWs(ws, event);
    }
  }
});

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
  const event = buildSessionList(sessionRegistry);
  for (const [ws] of wsStates) {
    sendWs(ws, event);
  }
}

createSessionListProjection(store, sessionRegistry, () => {
  broadcastSessionList();
});

function sendWs(ws: object, event: WsEvent) {
  try {
    (ws as { send(data: string): void }).send(JSON.stringify(event));
  } catch {
    // Connection already closed — clean up
    const wsState = wsStates.get(ws);
    if (wsState?.unsubscribe) wsState.unsubscribe();
    wsStates.delete(ws);
  }
}

function subscribeWsToSession(ws: object, sessionId: string) {
  const state = wsStates.get(ws);
  if (!state) return;

  // Unsubscribe from previous
  if (state.unsubscribe) {
    state.unsubscribe();
  }

  state.currentSessionId = sessionId;

  // Subscribe with session filter
  state.unsubscribe = store.subscribe((event: DomainEvent) => {
    if ("sessionId" in event && event.sessionId === sessionId) {
      sendWs(ws, event);
    }
  });
}

function replaySession(ws: object, sessionId: string) {
  const events = store.getBySessionId(sessionId);
  for (const event of events) {
    sendWs(ws, event);
  }
}

const server = Bun.serve<{ requestedSessionId: string | null }>({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const requestedSessionId = url.searchParams.get("sessionId") || null;
      const upgraded = server.upgrade(req, { data: { requestedSessionId } });
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
      wsStates.set(ws, { currentSessionId: null, unsubscribe: null });

      // Send session list
      sendWs(ws, buildSessionList(sessionRegistry));

      // Send latest spec list if available
      if (latestSpecListEvent) {
        sendWs(ws, latestSpecListEvent);
      }

      // Send latest git status if available
      if (latestGitStatusEvent) {
        sendWs(ws, latestGitStatusEvent);
      }

      // Determine which session to replay: prefer URL-requested, fall back to latest
      const requested = ws.data.requestedSessionId;
      const validRequested = requested && sessionRegistry.getState().sessions.has(requested)
        ? requested
        : null;
      const targetSessionId = validRequested ?? latestSession.getState().latestSessionId;

      if (targetSessionId) {
        const switchAndReplay = () => {
          sendWs(ws, {
            type: "SessionSwitched",
            sessionId: targetSessionId,
            seq: -1,
            timestamp: Date.now(),
          } as any);
          subscribeWsToSession(ws, targetSessionId);
          replaySession(ws, targetSessionId);
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
            } as any);
            subscribeWsToSession(ws, targetId);
            replaySession(ws, targetId);
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

    close(ws) {
      const wsState = wsStates.get(ws);
      if (wsState?.unsubscribe) {
        wsState.unsubscribe();
      }
      wsStates.delete(ws);
    },
  },
});

console.log(`Conclave server listening on http://localhost:${PORT}`);

// Start the ACP bridge, discover existing sessions, then create one if needed
bridge.start().then(async () => {
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
    watchSpecs(specsDir, (updatedSpecs) => {
      store.appendGlobal({ type: "SpecListUpdated", specs: updatedSpecs });
    });
  } catch (err) {
    console.error("Failed to scan specs:", err);
  }

  // Start git status poller
  startGitStatusPoller({
    cwd: CWD,
    intervalMs: 3000,
    onUpdate: (files) => {
      store.appendGlobal({ type: "GitStatusUpdated", files });
    },
  });

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
