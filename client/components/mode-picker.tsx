import React, { useState, useRef, useEffect } from "react";
import type { ModeClientInfo } from "../../server/types.ts";

type ModePickerProps = {
  modes: ModeClientInfo[];
  currentMode: string;
  onSetMode: (modeId: string) => void;
  disabled: boolean;
};

export function ModePicker({ modes, currentMode, onSetMode, disabled }: ModePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = modes.find((m) => m.id === currentMode) ?? modes[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!current) return null;

  if (modes.length <= 1) {
    return (
      <div className="mode-select" data-color={current.color}>
        <div className="mode-select__trigger mode-select__trigger--solo">
          <ModeIcon icon={current.icon} />
          <span className="mode-select__label">{current.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mode-select" ref={containerRef} data-color={current.color}>
      <button
        className={`mode-select__trigger${open ? " mode-select__trigger--open" : ""}`}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        type="button"
      >
        <ModeIcon icon={current.icon} />
        <span className="mode-select__label">{current.label}</span>
        <svg className="mode-select__chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2.5,3.5 5,6.5 7.5,3.5" />
        </svg>
      </button>
      {open && (
        <div className="mode-select__dropdown">
          {modes.map((mode) => {
            const isActive = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                className={`mode-select__option${isActive ? " mode-select__option--active" : ""}`}
                data-color={mode.color}
                onClick={() => {
                  if (!isActive) onSetMode(mode.id);
                  setOpen(false);
                }}
                type="button"
              >
                <ModeIcon icon={mode.icon} />
                <span className="mode-select__option-label">{mode.label}</span>
                {isActive && (
                  <svg className="mode-select__check" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5 6.5 5 9 9.5 3.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
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
      return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="6" cy="6" r="4.5" />
          <circle cx="6" cy="6" r="1.5" />
        </svg>
      );
  }
}
