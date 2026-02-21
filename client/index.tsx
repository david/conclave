import React, { useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useEventStore } from "./reducer.ts";
import { Chat } from "./components/chat.tsx";
import type { InputBarHandle } from "./components/input-bar.tsx";
import { Workspace } from "./components/workspace.tsx";
import type { WsEvent, Command, ImageAttachment } from "../server/types.ts";
import { getSessionIdFromUrl, pushSessionUrl, replaceSessionUrl, onPopState } from "./router.ts";

function App() {
  const { state, append } = useEventStore();
  const wsRef = useRef<WebSocket | null>(null);
  const inputBarRef = useRef<InputBarHandle>(null);

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

  // Prevent browser from navigating to pasted/dropped images; route to input bar
  useEffect(() => {
    function extractImageFiles(dt: DataTransfer): File[] {
      const files: File[] = [];
      for (const item of dt.items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      return files;
    }

    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      // Let the textarea's own handler deal with it when focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;

      const images = extractImageFiles(e.clipboardData);
      if (images.length > 0) {
        e.preventDefault();
        inputBarRef.current?.addImageFiles(images);
      }
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
    }

    function handleDrop(e: DragEvent) {
      e.preventDefault();
      if (!e.dataTransfer) return;
      const images = extractImageFiles(e.dataTransfer);
      if (images.length > 0) {
        inputBarRef.current?.addImageFiles(images);
      }
    }

    document.addEventListener("paste", handlePaste);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    return () => {
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

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

  // Show workspace sidebar when there are plan entries, git files, or specs
  const workspaceVisible = !!state.sessionId && (
    state.planEntries.length > 0 ||
    state.gitFiles.length > 0 ||
    state.specs.length > 0
  );

  const layoutClasses = [
    "app-layout",
    workspaceVisible ? "app-layout--workspace-visible" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={layoutClasses}>
      <Workspace
        entries={state.planEntries}
        gitFiles={state.gitFiles}
        specs={state.specs}
      />
      <Chat
        ref={inputBarRef}
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
