import React, { useEffect, useRef } from "react";
import type { Message, ToolCallInfo } from "../reducer.ts";
import { ToolCallCard } from "./tool-call.tsx";

type MessageListProps = {
  messages: Message[];
  currentAgentText: string;
  activeToolCalls: Map<string, ToolCallInfo>;
  isProcessing: boolean;
};

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={`message message--${message.role}`}>
      <div className="message__role">
        {message.role === "user" ? "You" : "Claude"}
      </div>
      {message.text && (
        <div className="message__text">{message.text}</div>
      )}
      {message.toolCalls?.map((tc) => (
        <ToolCallCard key={tc.toolCallId} toolCall={tc} />
      ))}
    </div>
  );
}

export function MessageList({
  messages,
  currentAgentText,
  activeToolCalls,
  isProcessing,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentAgentText, activeToolCalls.size]);

  const activeToolCallList = Array.from(activeToolCalls.values());
  const hasStreaming = currentAgentText.length > 0 || activeToolCallList.length > 0;

  return (
    <div className="message-list">
      {messages.length === 0 && !hasStreaming && (
        <div className="message-list__empty">
          Send a message to start a conversation with Claude Code.
        </div>
      )}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {hasStreaming && (
        <div className="message message--assistant message--streaming">
          <div className="message__role">Claude</div>
          {currentAgentText && (
            <div className="message__text">{currentAgentText}</div>
          )}
          {activeToolCallList.map((tc) => (
            <ToolCallCard key={tc.toolCallId} toolCall={tc} />
          ))}
        </div>
      )}
      {isProcessing && !hasStreaming && (
        <div className="message message--assistant message--thinking">
          <div className="message__role">Claude</div>
          <div className="message__text message__thinking">Thinking...</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
