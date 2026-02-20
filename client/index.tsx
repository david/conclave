import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useEventStore } from "./reducer.ts";
import { Chat } from "./components/chat.tsx";
import { Workspace } from "./components/workspace.tsx";
import type { WsEvent, Command, ImageAttachment } from "../server/types.ts";
import { getSessionIdFromUrl, pushSessionUrl, replaceSessionUrl, onPopState } from "./router.ts";
import { parseRequirements } from "./parse-requirements.ts";
import type { Message } from "./types.ts";

function App() {
  const { state, append } = useEventStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const sessionId = getSessionIdFromUrl();
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws${query}`);
      wsRef.current = ws;

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === "Reload") {
            const overlay = document.createElement("div");
            overlay.className = "reload-overlay";
            overlay.innerHTML =
              '<div class="reload-overlay__bar"></div>' +
              '<div class="reload-overlay__label">rebuilding</div>';
            document.body.appendChild(overlay);
            setTimeout(() => window.location.reload(), 600);
            return;
          }
          append(data as WsEvent);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const sendCommand = useCallback((cmd: Command) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cmd));
    }
  }, []);

  const handleSubmit = useCallback(
    (text: string, images?: ImageAttachment[]) => {
      sendCommand({ command: "submit_prompt", text, images });
    },
    [sendCommand],
  );

  const handleCancel = useCallback(() => {
    sendCommand({ command: "cancel" });
  }, [sendCommand]);

  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      sendCommand({ command: "switch_session", sessionId });
    },
    [sendCommand],
  );

  const handleCreateSession = useCallback(() => {
    if (state.creatingSession) return;
    append({ type: "SessionInitiated" });
    sendCommand({ command: "create_session" });
  }, [sendCommand, state.creatingSession]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handleCreateSession();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateSession]);

  // Sync URL to current session
  const isFirstSession = useRef(true);
  useEffect(() => {
    if (!state.sessionId) return;
    if (isFirstSession.current) {
      replaceSessionUrl(state.sessionId);
      isFirstSession.current = false;
    } else {
      pushSessionUrl(state.sessionId);
    }
  }, [state.sessionId]);

  // Handle browser back/forward
  useEffect(() => {
    return onPopState((sessionId) => {
      if (sessionId && sessionId !== state.sessionId) {
        handleSwitchSession(sessionId);
      }
    });
  }, [handleSwitchSession, state.sessionId]);

  const handleSetMode = useCallback(
    (modeId: string) => {
      sendCommand({ command: "set_mode", modeId });
    },
    [sendCommand],
  );

  // Derive use cases from assistant messages + streaming content
  const useCases = useMemo(() => {
    const messageText = state.messages
      .filter((m: Message) => m.role === "assistant")
      .flatMap((m: Message) => m.content)
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");
    const streamingText = state.streamingContent
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("\n");
    return parseRequirements(messageText + "\n" + streamingText);
  }, [state.messages, state.streamingContent]);

  // Show workspace only when there's content to display
  const workspaceVisible = !!state.sessionId && (
    state.planEntries.length > 0 ||
    state.fileChanges.length > 0 ||
    useCases.length > 0
  );

  return (
    <div className={`app-layout${workspaceVisible ? " app-layout--workspace-visible" : ""}`}>
      <Workspace
        entries={state.planEntries}
        fileChanges={state.fileChanges}
        useCases={useCases}
      />
      <Chat
        state={state}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onSwitchSession={handleSwitchSession}
        onCreateSession={handleCreateSession}
        onSetMode={handleSetMode}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
