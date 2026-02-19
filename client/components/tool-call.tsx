import React from "react";
import type { ToolCallInfo } from "../reducer.ts";
import { StatusDot, Chevron } from "./icons.tsx";
import { useCollapsible } from "../hooks/use-collapsible.ts";

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
  const hasDetails =
    toolCall.input !== undefined || toolCall.output !== undefined;

  const { expanded, headerProps } = useCollapsible(hasDetails);

  return (
    <div className="tool-call" data-status={toolCall.status}>
      <div className="tool-call__header" {...headerProps}>
        <span className="tool-call__icon">
          <StatusDot status={toolCall.status} />
        </span>
        <span className="tool-call__name">{toolCall.toolName}</span>
        {toolCall.kind && (
          <span className="tool-call__kind">{toolCall.kind}</span>
        )}
        {hasDetails && (
          <span className="tool-call__toggle">
            <Chevron expanded={expanded} />
          </span>
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
