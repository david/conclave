import { EventStore } from "./event-store.ts";
import { AcpBridge, formatError } from "./acp-bridge.ts";
import type { Command, DomainEvent, SessionListEvent, WsEvent } from "./types.ts";
import { join } from "path";

const PORT = Number(process.env.PORT) || 3000;
const CWD = process.env.CONCLAVE_CWD || process.cwd();

const store = new EventStore();

// Session metadata
type SessionMeta = { sessionId: string; name: string; title: string | null; firstPrompt: string | null; loaded: boolean };
const sessions = new Map<string, SessionMeta>();
let sessionCounter = 0;

// Latest session for new WS connections
let latestSessionId: string | null = null;

// Per-WS state
type WsState = { currentSessionId: string | null; unsubscribe: (() => void) | null };
const wsStates = new Map<object, WsState>();

const bridge = new AcpBridge(CWD, (sessionId, payload) => {
  // Skip system-level errors without a real session
  if (sessionId === "__system__") {
    console.error("System error:", (payload as { message?: string }).message);
    return;
  }
  store.append(sessionId, payload);

  // Track firstPrompt
  if (payload.type === "PromptSubmitted") {
    const meta = sessions.get(sessionId);
    if (meta && !meta.firstPrompt) {
      meta.firstPrompt = payload.text;
      broadcastSessionList();
    }
  }
});

bridge.onTitleUpdate = (sessionId: string, title: string) => {
  const meta = sessions.get(sessionId);
  if (meta) {
    meta.title = title;
    broadcastSessionList();
  }
};

function buildSessionList(): SessionListEvent {
  return {
    type: "SessionList",
    sessions: Array.from(sessions.values()),
    seq: -1,
    timestamp: Date.now(),
  };
}

function broadcastSessionList() {
  const msg = JSON.stringify(buildSessionList());
  for (const [ws] of wsStates) {
    (ws as { send(data: string): void }).send(msg);
  }
}

function sendWs(ws: object, event: WsEvent) {
  (ws as { send(data: string): void }).send(JSON.stringify(event));
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
    if (event.sessionId === sessionId) {
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

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }

    // Static file serving from dist/
    const distDir = join(import.meta.dir, "..", "dist");
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(distDir, filePath));

    if (await file.exists()) {
      return new Response(file, {
        headers: { "Cache-Control": "no-cache" },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      wsStates.set(ws, { currentSessionId: null, unsubscribe: null });

      // Send session list
      sendWs(ws, buildSessionList());

      // Replay latest session if one exists
      if (latestSessionId) {
        replaySession(ws, latestSessionId);
        subscribeWsToSession(ws, latestSessionId);
      }
    },

    async message(ws, message) {
      try {
        const cmd = JSON.parse(String(message)) as Command;
        const state = wsStates.get(ws);

        switch (cmd.command) {
          case "submit_prompt": {
            const sessionId = state?.currentSessionId;
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
            bridge.submitPrompt(sessionId, cmd.text);
            break;
          }

          case "cancel": {
            const sessionId = state?.currentSessionId;
            if (sessionId) {
              bridge.cancel(sessionId);
            }
            break;
          }

          case "create_session": {
            try {
              const sessionId = await bridge.createSession();
              const name = `Session ${++sessionCounter}`;
              sessions.set(sessionId, { sessionId, name, title: null, firstPrompt: null, loaded: true });
              store.append(sessionId, { type: "SessionCreated" });
              latestSessionId = sessionId;

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

              broadcastSessionList();
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

          case "permission_response": {
            const sessionId = state?.currentSessionId;
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
            if (!bridge.respondPermission(sessionId, cmd.optionId)) {
              sendWs(ws, {
                type: "Error",
                message: "No pending permission request",
                seq: -1,
                timestamp: Date.now(),
                sessionId: "",
              });
              return;
            }
            // If rejection feedback was provided, submit it as a new prompt
            // after a short delay for the turn to finish.
            if (cmd.feedback) {
              setTimeout(() => {
                bridge.submitPrompt(sessionId, cmd.feedback!);
              }, 500);
            }
            break;
          }

          case "switch_session": {
            const targetId = cmd.sessionId;
            const targetMeta = sessions.get(targetId);
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
                targetMeta.loaded = true;
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
      const state = wsStates.get(ws);
      if (state?.unsubscribe) {
        state.unsubscribe();
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
  for (const s of existing) {
    const name = s.title || `Session ${++sessionCounter}`;
    sessions.set(s.sessionId, {
      sessionId: s.sessionId,
      name,
      title: s.title ?? null,
      firstPrompt: null,
      loaded: false,
    });
  }

  if (existing.length > 0) {
    // Default to most recent existing session (don't load it yet — will load on switch or first use)
    latestSessionId = existing[0].sessionId;
    console.log(`Found ${existing.length} existing session(s), latest: ${latestSessionId}`);
  }

  // Always create a fresh session to start with
  try {
    const sessionId = await bridge.createSession();
    const name = `Session ${++sessionCounter}`;
    sessions.set(sessionId, { sessionId, name, title: null, firstPrompt: null, loaded: true });
    store.append(sessionId, { type: "SessionCreated" });
    latestSessionId = sessionId;
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
