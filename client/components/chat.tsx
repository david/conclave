import React, { useCallback, useState } from "react";
import { MessageList } from "./message-list.tsx";
import { InputBar } from "./input-bar.tsx";
import { SessionPicker } from "./session-picker.tsx";
import type { AppState } from "../reducer.ts";
import type { ImageAttachment } from "../../server/types.ts";
import { getModeInfo } from "../mode-config.ts";

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

function usageLevel(pct: number): "normal" | "warning" | "critical" {
  if (pct >= 90) return "critical";
  if (pct >= 70) return "warning";
  return "normal";
}

function ContextBar({ usage }: { usage: NonNullable<AppState["usage"]> }) {
  const pct = Math.min(100, (usage.used / usage.size) * 100);
  const level = usageLevel(pct);

  return (
    <div className={`context-bar context-bar--${level}`}>
      <div className="context-bar__track">
        <div
          className="context-bar__fill"
          style={{ width: `${pct}%` }}
        />
        {/* Glow concentrated at the fill edge */}
        <div
          className="context-bar__glow"
          style={{ left: `${Math.max(0, pct - 4)}%` }}
        />
      </div>
      <div className="context-bar__meta">
        <span className="context-bar__label">context</span>
        <span className="context-bar__pct">{pct.toFixed(0)}%</span>
        <span className="context-bar__tokens">
          {formatTokenCount(usage.used)}<span className="context-bar__slash">/</span>{formatTokenCount(usage.size)}
        </span>
        {usage.costAmount != null && (
          <span className="context-bar__cost">
            {formatCost(usage.costAmount, usage.costCurrency)}
          </span>
        )}
      </div>
    </div>
  );
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
        <div className="chat__header-row">
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
        </div>
        {state.usage && <ContextBar usage={state.usage} />}
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
        placeholder={getModeInfo(state.availableModes, state.currentMode).placeholder}
      />
    </div>
  );
}
