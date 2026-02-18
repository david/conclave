import React from "react";
import { MessageList } from "./message-list.tsx";
import { InputBar } from "./input-bar.tsx";
import { SessionPicker } from "./session-picker.tsx";
import type { AppState } from "../reducer.ts";

type ChatProps = {
  state: AppState;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onSwitchSession: (sessionId: string) => void;
  onCreateSession: () => void;
};

export function Chat({ state, onSubmit, onCancel, onSwitchSession, onCreateSession }: ChatProps) {
  return (
    <div className="chat">
      <header className="chat__header">
        <h1 className="chat__title">Conclave</h1>
        <SessionPicker
          sessions={state.sessions}
          currentSessionId={state.sessionId}
          onSwitch={onSwitchSession}
          onCreate={onCreateSession}
          isDisabled={false}
        />
      </header>
      {state.error && (
        <div className="chat__error">{state.error}</div>
      )}
      <MessageList
        messages={state.messages}
        currentAgentText={state.currentAgentText}
        activeToolCalls={state.activeToolCalls}
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
