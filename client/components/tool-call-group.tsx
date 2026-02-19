import React, { useState } from "react";
import type { ToolCallBlock } from "../reducer.ts";
import { ToolCallCard } from "./tool-call.tsx";
import { StatusDot, Chevron } from "./icons.tsx";

type ToolCallGroupProps = {
  blocks: ToolCallBlock[];
};

export function ToolCallGroup({ blocks }: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false);

  const last = blocks[blocks.length - 1].toolCall;
  const count = blocks.length;

  return (
    <div className={`tool-call-group tool-call-group--${last.status}`}>
      <div
        className="tool-call-group__summary"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setExpanded(!expanded);
          }
        }}
      >
        <span className="tool-call-group__icon">
          <StatusDot status={last.status} />
        </span>
        <span className="tool-call-group__name">{last.toolName}</span>
        <span className="tool-call-group__count">
          ({count} tool call{count !== 1 ? "s" : ""})
        </span>
        <span className="tool-call-group__toggle">
          <Chevron expanded={expanded} />
        </span>
      </div>
      {expanded && (
        <div className="tool-call-group__items">
          {blocks.map((block, i) => (
            <ToolCallCard key={i} toolCall={block.toolCall} />
          ))}
        </div>
      )}
    </div>
  );
}
