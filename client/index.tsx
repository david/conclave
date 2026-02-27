import React, { useEffect, useRef, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { useEventStore } from "./reducer.ts";
import { Chat } from "./components/chat.tsx";
import type { InputBarHandle } from "./components/input-bar.tsx";
import { Workspace } from "./components/workspace.tsx";
import { TabBar } from "./components/tab-bar.tsx";
import { useVisualViewport } from "./hooks/use-visual-viewport.ts";
import type { WsEvent, WsCommand, ImageAttachment } from "../server/types.ts";
import type { NextBlockClickPayload } from "./components/next-block-button.tsx";
import { getSessionIdFromUrl, pushSessionUrl, replaceSessionUrl, onPopState } from "./router.ts";
import { isWorkspaceVisible } from "./workspace-visible.ts";

function App() {
  const { state, append } = useEventStore();
  const wsRef = useRef<WebSocket | null>(null);
  const inputBarRef = useRef<InputBarHandle>(null);

  // Track server epoch and last-seen seq for delta reconnect.
  // On reconnect, if the epoch matches the server's, only events after lastSeq are replayed.
  const epochRef = useRef<string | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const sessionId = getSessionIdFromUrl();
      const params = new URLSearchParams();
      if (sessionId) params.set("sessionId", sessionId);
      if (epochRef.current && lastSeqRef.current > 0) {
        params.set("epoch", epochRef.current);
        params.set("lastSeq", String(lastSeqRef.current));
      }
      const query = params.toString() ? `?${params}` : "";
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

          // Track epoch from SessionSwitched events (full replay from server)
          if (data.type === "SessionSwitched" && data.epoch) {
            epochRef.current = data.epoch;
            lastSeqRef.current = 0;
          }

          // Track the highest seq seen for delta reconnect
          if (typeof data.seq === "number" && data.seq > 0) {
            lastSeqRef.current = Math.max(lastSeqRef.current, data.seq);
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

  const sendCommand = useCallback((cmd: WsCommand) => {
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

  const handleNextBlockClick = useCallback(
    (payload: NextBlockClickPayload) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          command: "next_block_click",
          label: payload.label,
          commandText: payload.command,
          metaContext: payload.metaContext,
        }));
      }
    },
    [],
  );

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

  // Mobile detection via matchMedia
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  const [mobilePane, setMobilePane] = useState<"workspace" | "chat">("chat");
  const [chatNotification, setChatNotification] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Notification dot: when on workspace tab and isProcessing transitions to false
  const prevProcessing = useRef(state.isProcessing);
  useEffect(() => {
    if (isMobile && mobilePane === "workspace" && prevProcessing.current && !state.isProcessing) {
      setChatNotification(true);
    }
    prevProcessing.current = state.isProcessing;
  }, [state.isProcessing, isMobile, mobilePane]);

  // Visual viewport tracking for keyboard detection
  const { keyboardOpen } = useVisualViewport();

  // Auto-scroll message list when keyboard opens
  const prevKeyboardOpen = useRef(false);
  useEffect(() => {
    if (isMobile && keyboardOpen && !prevKeyboardOpen.current) {
      const timer = setTimeout(() => {
        const el = document.querySelector('.message-list');
        if (el) el.scrollTop = el.scrollHeight;
      }, 300);
      prevKeyboardOpen.current = keyboardOpen;
      return () => clearTimeout(timer);
    }
    prevKeyboardOpen.current = keyboardOpen;
  }, [keyboardOpen, isMobile]);

  const workspaceVisible = isWorkspaceVisible(isMobile, state);

  const layoutClasses = [
    "app-layout",
    !isMobile && workspaceVisible ? "app-layout--workspace-visible" : "",
    isMobile && keyboardOpen ? "app-layout--keyboard-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={layoutClasses}>
      {(!isMobile || mobilePane === "workspace") && (
        <Workspace
          entries={state.planEntries}
          gitFiles={state.gitFiles}
          specs={state.specs}
          services={state.services}
          servicesAvailable={state.servicesAvailable}
        />
      )}
      {(!isMobile || mobilePane === "chat") && (
        <Chat
          ref={inputBarRef}
          state={state}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onSwitchSession={handleSwitchSession}
          onCreateSession={handleCreateSession}
          onNextBlockClick={handleNextBlockClick}
        />
      )}
      {isMobile && (
        <TabBar
          activePane={mobilePane}
          onSwitch={(pane) => {
            setMobilePane(pane);
            if (pane === "chat") setChatNotification(false);
          }}
          chatNotification={chatNotification}
        />
      )}
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
