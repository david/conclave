import React from "react";

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
  return (
    <button
      className={`next-block-btn${disabled ? " next-block-btn--disabled" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onRun({ label, command, metaContext });
        }
      }}
    >
      {label}
    </button>
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
