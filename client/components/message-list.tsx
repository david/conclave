import React, { useEffect, useRef } from "react";
import type {
  Message,
  ContentBlock,
  TextBlock,
  ToolCallBlock,
} from "../reducer.ts";
import { ToolCallCard } from "./tool-call.tsx";
import { ToolCallGroup } from "./tool-call-group.tsx";
import { MarkdownText } from "./markdown-text.tsx";

type MessageListProps = {
  messages: Message[];
  streamingContent: ContentBlock[];
  isProcessing: boolean;
};

type RenderSegment =
  | { kind: "text"; block: TextBlock }
  | { kind: "tool_call_group"; blocks: ToolCallBlock[] };

function groupContentBlocks(blocks: ContentBlock[]): RenderSegment[] {
  const segments: RenderSegment[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      segments.push({ kind: "text", block });
    } else {
      const last = segments[segments.length - 1];
      if (last && last.kind === "tool_call_group") {
        last.blocks.push(block);
      } else {
        segments.push({ kind: "tool_call_group", blocks: [block] });
      }
    }
  }
  return segments;
}

function RenderSegmentView({
  segment,
  role,
}: {
  segment: RenderSegment;
  role: "user" | "assistant";
}) {
  if (segment.kind === "text") {
    if (role === "assistant") {
      return <MarkdownText text={segment.block.text} />;
    }
    return <div className="message__text">{segment.block.text}</div>;
  }
  if (segment.blocks.length === 1) {
    return <ToolCallCard toolCall={segment.blocks[0].toolCall} />;
  }
  return <ToolCallGroup blocks={segment.blocks} />;
}

function MessageBubble({ message }: { message: Message }) {
  const segments = groupContentBlocks(message.content);
  return (
    <div className={`message message--${message.role}`}>
      <div className="message__role">
        {message.role === "user" ? "You" : "Claude"}
      </div>
      {segments.map((segment, i) => (
        <RenderSegmentView key={i} segment={segment} role={message.role} />
      ))}
    </div>
  );
}

export function MessageList({
  messages,
  streamingContent,
  isProcessing,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const hasStreaming = streamingContent.length > 0;
  const streamingSegments = hasStreaming
    ? groupContentBlocks(streamingContent)
    : [];

  return (
    <div className="message-list">
      {messages.length === 0 && !hasStreaming && (
        <div className="message-list__empty">
          <span className="message-list__empty-brand">Conclave</span>
          <span className="message-list__empty-hint">Start a conversation with Claude Code</span>
        </div>
      )}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {hasStreaming && (
        <div className="message message--assistant message--streaming">
          <div className="message__role">Claude</div>
          {streamingSegments.map((segment, i) => (
            <RenderSegmentView key={i} segment={segment} role="assistant" />
          ))}
        </div>
      )}
      {isProcessing && !hasStreaming && (
        <div className="message message--assistant message--thinking">
          <div className="message__role">Claude</div>
          <div className="message__thinking">
            <span className="message__thinking-dot" />
            <span className="message__thinking-dot" />
            <span className="message__thinking-dot" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
