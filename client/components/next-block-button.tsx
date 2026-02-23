import React, { useState } from "react";

export type NextBlockClickPayload = {
  label: string;
  command: string;
  metaContext: string;
};

type NextBlockButtonProps = {
  label: string;
  command: string;
  metaContext: string;
  onRun: (payload: NextBlockClickPayload) => void;
  disabled?: boolean;
};

export function NextBlockButton({ label, command, metaContext, onRun, disabled }: NextBlockButtonProps) {
  const [clicked, setClicked] = useState(false);
  const isDisabled = disabled || clicked;

  return (
    <div
      className={`next-block${isDisabled ? " next-block--disabled" : ""}`}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) {
          setClicked(true);
          onRun({ label, command, metaContext });
        }
      }}
      onKeyDown={(e) => {
        if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setClicked(true);
          onRun({ label, command, metaContext });
        }
      }}
    >
      <div className="next-block__rule">
        <div className="next-block__line" />
        <div className="next-block__diamond" />
        <div className="next-block__line" />
      </div>
      <div className="next-block__label">
        <span className="next-block__text">{label}</span>
        <svg className="next-block__arrow" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </div>
    </div>
  );
}

export type ParsedNextBlock =
  | { valid: true; label: string; command: string; metaContext?: string }
  | { valid: false };

export function parseNextBlock(json: string): ParsedNextBlock {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.label === "string" && typeof parsed.command === "string") {
      return {
        valid: true,
        label: parsed.label,
        command: parsed.command,
        metaContext: typeof parsed.metaContext === "string" && parsed.metaContext ? parsed.metaContext : undefined,
      };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}
