import React, { useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useEventStore } from "./reducer.ts";
import { Chat } from "./components/chat.tsx";
import { Workspace } from "./components/workspace.tsx";
import type { WsEvent, Command, ImageAttachment } from "../server/types.ts";
import { getSessionIdFromUrl, pushSessionUrl, replaceSessionUrl, onPopState } from "./router.ts";

function App() {
  const { state, append } = useEventStore();
  const wsRef = useRef<WebSocket | null>(null);

  // Workspace is visible during plan review or while actively processing
  const isPlanReview = state.currentMode === "plan" || state.pendingPermission !== null;
  const hasWorkContent = state.planEntries.length > 0 || state.fileChanges.length > 0 || !!state.planContent;
  const workspaceVisible = isPlanReview || (state.isProcessing && hasWorkContent);

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

  const handlePermissionResponse = useCallback(
    (optionId: string, feedback?: string) => {
      sendCommand({ command: "permission_response", optionId, feedback });
    },
    [sendCommand],
  );

  return (
    <div className={`app-layout${workspaceVisible ? " app-layout--workspace-visible" : ""}`}>
      <Workspace
        entries={state.planEntries}
        fileChanges={state.fileChanges}
        currentMode={state.currentMode}
        planContent={state.planContent}
        isProcessing={state.isProcessing}
        pendingPermission={state.pendingPermission}
        onPermissionResponse={handlePermissionResponse}
      />
      <Chat
        state={state}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onSwitchSession={handleSwitchSession}
        onCreateSession={handleCreateSession}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
