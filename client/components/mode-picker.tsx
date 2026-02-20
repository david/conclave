import React from "react";
import type { ModeClientInfo } from "../../server/types.ts";

type ModePickerProps = {
  modes: ModeClientInfo[];
  currentMode: string;
  onSetMode: (modeId: string) => void;
  disabled: boolean;
};

export function ModePicker({ modes, currentMode, onSetMode, disabled }: ModePickerProps) {
  if (modes.length <= 1) {
    // Single mode — just show the label, no picker needed
    const mode = modes[0];
    if (!mode) return null;
    return (
      <div className="mode-picker">
        <span className="mode-picker__single" data-color={mode.color}>{mode.label}</span>
      </div>
    );
  }

  return (
    <div className="mode-picker">
      {modes.map((mode) => {
        const isActive = currentMode === mode.id;
        return (
          <button
            key={mode.id}
            className={`mode-picker__btn${isActive ? " mode-picker__btn--active" : ""}`}
            data-color={mode.color}
            onClick={() => onSetMode(mode.id)}
            disabled={disabled || isActive}
            title={mode.label}
          >
            <ModeIcon icon={mode.icon} />
            <span className="mode-picker__label">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModeIcon({ icon }: { icon: string }) {
  const size = 12;
  switch (icon) {
    case "chat":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5l-2.5 2V9H3a2 2 0 0 1-2-2V3z" />
        </svg>
      );
    case "search":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="5.5" cy="5.5" r="3.5" />
          <line x1="8" y1="8" x2="10.5" y2="10.5" />
        </svg>
      );
    case "blueprint":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="10" height="10" rx="1.5" />
          <line x1="1" y1="5" x2="11" y2="5" />
          <line x1="6" y1="1" x2="6" y2="11" />
        </svg>
      );
    case "code":
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3.5,2 1,6 3.5,10" />
          <polyline points="8.5,2 11,6 8.5,10" />
        </svg>
      );
    default:
      // Generic mode icon
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="6" cy="6" r="4.5" />
          <circle cx="6" cy="6" r="1.5" />
        </svg>
      );
  }
}
