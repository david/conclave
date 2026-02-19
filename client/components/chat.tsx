import React, { useCallback, useState } from "react";
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
  const [copied, setCopied] = useState(false);

  const handleCopySessionId = useCallback(() => {
    if (!state.sessionId) return;
    navigator.clipboard.writeText(state.sessionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [state.sessionId]);

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
        <button
          className="chat__copy-session-btn"
          onClick={handleCopySessionId}
          disabled={!state.sessionId}
          title={copied ? "Copied!" : "Copy session ID"}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2.5 7.5 5.5 10.5 11.5 4" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.5" />
              <path d="M9.5 4.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v5A1.5 1.5 0 0 0 3 9.5h1.5" />
            </svg>
          )}
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
