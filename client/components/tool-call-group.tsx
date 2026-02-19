import React from "react";
import type { ToolCallBlock } from "../reducer.ts";
import { ToolCallCard } from "./tool-call.tsx";
import { StatusDot, Chevron } from "./icons.tsx";
import { useCollapsible } from "../hooks/use-collapsible.ts";

type ToolCallGroupProps = {
  blocks: ToolCallBlock[];
};

export function ToolCallGroup({ blocks }: ToolCallGroupProps) {
  const { expanded, headerProps } = useCollapsible();

  const last = blocks[blocks.length - 1].toolCall;
  const count = blocks.length;

  return (
    <div className="tool-call-group" data-status={last.status}>
      <div className="tool-call-group__summary" {...headerProps}>
        <span className="tool-call-group__icon">
          <StatusDot status={last.status} />
        </span>
        <span className="tool-call-group__label">
          {count} tool call{count !== 1 ? "s" : ""}
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
