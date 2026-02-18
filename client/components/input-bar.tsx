import React, { useState, useRef, useCallback } from "react";

type InputBarProps = {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
};

export function InputBar({ onSubmit, onCancel, isProcessing }: InputBarProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;
    onSubmit(trimmed);
    setText("");
  }, [text, isProcessing, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="input-bar">
      <textarea
        ref={textareaRef}
        className="input-bar__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isProcessing ? "Waiting for response..." : "Type a message..."}
        disabled={isProcessing}
        rows={1}
      />
      {isProcessing ? (
        <button className="input-bar__btn input-bar__btn--cancel" onClick={onCancel}>
          Cancel
        </button>
      ) : (
        <button
          className="input-bar__btn input-bar__btn--send"
          onClick={handleSubmit}
          disabled={!text.trim()}
        >
          Send
        </button>
      )}
    </div>
  );
}
