import React from "react";
import { MessageList } from "./message-list.tsx";
import { InputBar } from "./input-bar.tsx";
import { SessionPicker } from "./session-picker.tsx";
import type { AppState } from "../reducer.ts";
import type { ImageAttachment } from "../../server/types.ts";

type ChatProps = {
  state: AppState;
  onSubmit: (text: string, images?: ImageAttachment[]) => void;
  onCancel: () => void;
  onSwitchSession: (sessionId: string) => void;
  onCreateSession: () => void;
};

export function Chat({ state, onSubmit, onCancel, onSwitchSession, onCreateSession }: ChatProps) {
  return (
    <div className="chat">
      <header className="chat__header">
        <SessionPicker
          sessions={state.sessions}
          currentSessionId={state.sessionId}
          onSwitch={onSwitchSession}
          onCreate={onCreateSession}
          isDisabled={false}
        />
        <button
          className="chat__new-session-btn"
          onClick={onCreateSession}
          title="New session"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="7" y1="1" x2="7" y2="13" />
            <line x1="1" y1="7" x2="13" y2="7" />
          </svg>
        </button>
      </header>
      {state.error && (
        <div className="chat__error">{state.error}</div>
      )}
      <MessageList
        messages={state.messages}
        streamingContent={state.streamingContent}
        isProcessing={state.isProcessing}
      />
      <InputBar
        onSubmit={onSubmit}
        onCancel={onCancel}
        isProcessing={state.isProcessing}
      />
    </div>
  );
}
