import React from "react";

type TabBarProps = {
  activePane: "workspace" | "chat";
  onSwitch: (pane: "workspace" | "chat") => void;
  chatNotification?: boolean;
};

export function TabBar({ activePane, onSwitch, chatNotification }: TabBarProps) {
  return (
    <nav className="tab-bar">
      <button
        className={`tab-bar__tab${activePane === "workspace" ? " tab-bar__tab--active" : ""}`}
        onClick={() => onSwitch("workspace")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="11" y="3" width="6" height="6" rx="1" />
          <rect x="3" y="11" width="6" height="6" rx="1" />
          <rect x="11" y="11" width="6" height="6" rx="1" />
        </svg>
        <span>Workspace</span>
      </button>
      <button
        className={`tab-bar__tab${activePane === "chat" ? " tab-bar__tab--active" : ""}`}
        onClick={() => onSwitch("chat")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1z" />
        </svg>
        <span>Chat</span>
        {chatNotification && <span className="tab-bar__dot" />}
      </button>
    </nav>
  );
}
