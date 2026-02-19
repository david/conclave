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

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(amount: number, currency?: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "\u20AC" : (currency ?? "");
  return `${symbol}${amount.toFixed(4)}`;
}

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
        {state.usage && (
          <div className="chat__usage">
            <span className="chat__usage-tokens">
              {formatTokenCount(state.usage.used)} / {formatTokenCount(state.usage.size)}
            </span>
            {state.usage.costAmount != null && (
              <>
                <span className="chat__usage-sep" aria-hidden="true">&middot;</span>
                <span className="chat__usage-cost">
                  {formatCost(state.usage.costAmount, state.usage.costCurrency)}
                </span>
              </>
            )}
          </div>
        )}
        <button
          className="chat__new-session-btn"
          onClick={onCreateSession}
          disabled={state.creatingSession}
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
