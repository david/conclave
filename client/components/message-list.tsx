import React, { useEffect, useRef } from "react";
import type {
  Message,
  ContentBlock,
  TextBlock,
  ImageBlock,
  ToolCallBlock,
  ThoughtBlock,
} from "../reducer.ts";
import { ToolCallCard } from "./tool-call.tsx";
import { ToolCallGroup } from "./tool-call-group.tsx";
import { UserMarkdown } from "./user-markdown.tsx";
import { AssistantMarkdown } from "./assistant-markdown.tsx";
import type { NextBlockClickPayload } from "./next-block-button.tsx";
import { Chevron } from "./icons.tsx";
import { useCollapsible } from "../hooks/use-collapsible.ts";

type MessageListProps = {
  messages: Message[];
  streamingContent: ContentBlock[];
  isProcessing: boolean;
  onNextBlockClick?: (payload: NextBlockClickPayload) => void;
};

type RenderSegment =
  | { kind: "text"; block: TextBlock }
  | { kind: "image"; block: ImageBlock }
  | { kind: "thought"; block: ThoughtBlock }
  | { kind: "tool_call_group"; blocks: ToolCallBlock[] };

function groupContentBlocks(blocks: ContentBlock[]): RenderSegment[] {
  const segments: RenderSegment[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      segments.push({ kind: "text", block });
    } else if (block.type === "image") {
      segments.push({ kind: "image", block });
    } else if (block.type === "thought") {
      segments.push({ kind: "thought", block });
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

function ThoughtBlockView({ text }: { text: string }) {
  const preview = text.split("\n")[0].slice(0, 80);
  const isLong = text.length > 80 || text.includes("\n");
  const { expanded, headerProps } = useCollapsible(isLong);

  return (
    <div className="thought-block">
      <div className="thought-block__header" {...headerProps}>
        <span className="thought-block__icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <circle cx="7" cy="5.5" r="4" />
            <line x1="5.5" y1="10.5" x2="8.5" y2="10.5" />
            <line x1="6" y1="12.5" x2="8" y2="12.5" />
          </svg>
        </span>
        <span className="thought-block__label">Thinking</span>
        {isLong && (
          <span className="thought-block__toggle">
            <Chevron expanded={expanded} />
          </span>
        )}
      </div>
      {expanded || !isLong ? (
        <div className="thought-block__content">
          <AssistantMarkdown text={text} />
        </div>
      ) : (
        <div className="thought-block__preview">{preview}...</div>
      )}
    </div>
  );
}

function RenderSegmentView({
  segment,
  role,
  onNextBlockClick,
  isReplay,
}: {
  segment: RenderSegment;
  role: "user" | "assistant";
  onNextBlockClick?: (payload: NextBlockClickPayload) => void;
  isReplay?: boolean;
}) {
  if (segment.kind === "text") {
    if (role === "assistant") {
      return <AssistantMarkdown text={segment.block.text} onNextBlockClick={onNextBlockClick} isReplay={isReplay} />;
    }
    return <UserMarkdown text={segment.block.text} />;
  }
  if (segment.kind === "image") {
    return (
      <img
        src={`data:${segment.block.mimeType};base64,${segment.block.data}`}
        className="message__image"
        alt=""
      />
    );
  }
  if (segment.kind === "thought") {
    return <ThoughtBlockView text={segment.block.text} />;
  }
  if (segment.blocks.length === 1) {
    return <ToolCallCard toolCall={segment.blocks[0].toolCall} />;
  }
  return <ToolCallGroup blocks={segment.blocks} />;
}

function MessageBubble({ message, onNextBlockClick, isReplay }: { message: Message; onNextBlockClick?: (payload: NextBlockClickPayload) => void; isReplay?: boolean }) {
  const segments = groupContentBlocks(message.content);
  return (
    <div className={`message message--${message.role}`}>
      <div className="message__role">
        {message.role === "user" ? "You" : "Claude"}
      </div>
      {segments.map((segment, i) => (
        <RenderSegmentView key={i} segment={segment} role={message.role} onNextBlockClick={onNextBlockClick} isReplay={isReplay} />
      ))}
    </div>
  );
}

export function MessageList({
  messages,
  streamingContent,
  isProcessing,
  onNextBlockClick,
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
      {messages.map((msg, i) => {
        // The last assistant message keeps buttons enabled; all others are replay
        const isLastAssistant = msg.role === "assistant" && !hasStreaming &&
          messages.slice(i + 1).every((m) => m.role !== "assistant");
        return (
          <MessageBubble key={i} message={msg} onNextBlockClick={onNextBlockClick} isReplay={!isLastAssistant} />
        );
      })}
      {hasStreaming && (
        <div className="message message--assistant message--streaming">
          <div className="message__role">Claude</div>
          {streamingSegments.map((segment, i) => (
            <RenderSegmentView key={i} segment={segment} role="assistant" onNextBlockClick={onNextBlockClick} isReplay={false} />
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
