import React from "react";
import CreatableSelect from "react-select/creatable";
import type { SessionInfo } from "../reducer.ts";
import type { StylesConfig } from "react-select";

type SessionOption = {
  value: string;
  label: string;
};

type SessionPickerProps = {
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onSwitch: (sessionId: string) => void;
  onCreate: () => void;
  isDisabled: boolean;
};

const styles: StylesConfig<SessionOption, false> = {
  control: (base) => ({
    ...base,
    background: "var(--bg-surface)",
    borderColor: "var(--border)",
    borderRadius: "var(--radius-lg)",
    minWidth: 200,
    minHeight: 34,
    fontSize: 13,
    fontFamily: "var(--font-body)",
    "&:hover": { borderColor: "var(--text-muted)" },
    boxShadow: "none",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--text-secondary)",
    fontSize: 13,
  }),
  menu: (base) => ({
    ...base,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    zIndex: 100,
    overflow: "hidden",
  }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    background: isSelected
      ? "var(--accent-subtle)"
      : isFocused
        ? "var(--bg-hover)"
        : "transparent",
    color: isSelected ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 13,
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    "&:active": { background: "var(--accent-subtle)" },
  }),
  input: (base) => ({
    ...base,
    color: "var(--text)",
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--text-muted)",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--text-muted)",
    padding: "0 8px",
    "&:hover": { color: "var(--text-secondary)" },
  }),
};

function truncate(text: string, max: number): string {
  // Take first line only, then truncate to max chars
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= max) return firstLine;
  return firstLine.slice(0, max) + "...";
}

function sessionLabel(s: SessionInfo): string {
  if (s.title) return truncate(s.title, 60);
  if (s.firstPrompt) return truncate(s.firstPrompt, 60);
  return s.name;
}

export function SessionPicker({
  sessions,
  currentSessionId,
  onSwitch,
  onCreate,
  isDisabled,
}: SessionPickerProps) {
  const options: SessionOption[] = sessions.map((s) => ({
    value: s.sessionId,
    label: sessionLabel(s),
  }));

  const currentValue = options.find((o) => o.value === currentSessionId) ?? null;

  return (
    <CreatableSelect<SessionOption, false>
      styles={styles}
      options={options}
      value={currentValue}
      onChange={(option) => {
        if (option && option.value !== currentSessionId) {
          onSwitch(option.value);
        }
      }}
      onCreateOption={() => onCreate()}
      formatCreateLabel={() => "New session..."}
      isDisabled={isDisabled}
      placeholder="Select session..."
      isSearchable
      isClearable={false}
    />
  );
}
