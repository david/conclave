import React, { useState } from "react";
import type { ToolCallInfo } from "../reducer.ts";

function statusIcon(status: string): string {
  switch (status) {
    case "pending":
      return "\u23f3";
    case "in_progress":
      return "\u2699\ufe0f";
    case "completed":
      return "\u2705";
    case "failed":
      return "\u274c";
    default:
      return "\u2022";
  }
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails =
    toolCall.input !== undefined || toolCall.output !== undefined;

  return (
    <div className={`tool-call tool-call--${toolCall.status}`}>
      <div
        className="tool-call__header"
        onClick={() => hasDetails && setExpanded(!expanded)}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasDetails && (e.key === "Enter" || e.key === " ")) {
            setExpanded(!expanded);
          }
        }}
      >
        <span className="tool-call__icon">{statusIcon(toolCall.status)}</span>
        <span className="tool-call__name">{toolCall.toolName}</span>
        {toolCall.kind && (
          <span className="tool-call__kind">{toolCall.kind}</span>
        )}
        {hasDetails && (
          <span className="tool-call__toggle">{expanded ? "\u25bc" : "\u25b6"}</span>
        )}
      </div>
      {expanded && (
        <div className="tool-call__details">
          {toolCall.input !== undefined && (
            <div className="tool-call__section">
              <div className="tool-call__label">Input</div>
              <pre className="tool-call__code">
                {formatValue(toolCall.input)}
              </pre>
            </div>
          )}
          {toolCall.output !== undefined && (
            <div className="tool-call__section">
              <div className="tool-call__label">Output</div>
              <pre className="tool-call__code">
                {formatValue(toolCall.output)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
