import React, { useReducer, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { reducer, initialState } from "./reducer.ts";
import { Chat } from "./components/chat.tsx";
import type { WsEvent, Command } from "../server/types.ts";

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);

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
    (text: string) => {
      sendCommand({ command: "submit_prompt", text });
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
    sendCommand({ command: "create_session" });
  }, [sendCommand]);

  return (
    <Chat
      state={state}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      onSwitchSession={handleSwitchSession}
      onCreateSession={handleCreateSession}
    />
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
