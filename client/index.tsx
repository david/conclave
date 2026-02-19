import React, { useReducer, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { reducer, initialState, type ReducerEvent } from "./reducer.ts";
import { Chat } from "./components/chat.tsx";
import { Workspace } from "./components/workspace.tsx";
import type { WsEvent, Command, ImageAttachment } from "../server/types.ts";

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);

  // Workspace is visible whenever there's workspace-relevant content
  const workspaceVisible =
    state.currentMode === "plan" ||
    !!state.planContent ||
    state.pendingPermission !== null ||
    state.planEntries.length > 0;

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as WsEvent;
          dispatch(event);
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
    dispatch({ type: "CreatingSession" });
    sendCommand({ command: "create_session" });
  }, [sendCommand, state.creatingSession]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        handleCreateSession();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateSession]);

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
        currentMode={state.currentMode}
        planContent={state.planContent}
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
