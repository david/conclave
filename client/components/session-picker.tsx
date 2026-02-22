import React from "react";
import CreatableSelect from "react-select/creatable";
import type { SessionInfo } from "../reducer.ts";
import type { MetaContextInfo } from "../types.ts";
import type { StylesConfig, GroupBase } from "react-select";

type SessionOption = {
  value: string;
  label: string;
};

type SessionPickerProps = {
  sessions: SessionInfo[];
  metaContexts: MetaContextInfo[];
  currentSessionId: string | null;
  onSwitch: (sessionId: string) => void;
  onCreate: () => void;
  isDisabled: boolean;
};

const styles: StylesConfig<SessionOption, false, GroupBase<SessionOption>> = {
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
  groupHeading: (base) => ({
    ...base,
    fontFamily: "var(--font-display)",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    padding: "8px 12px 4px",
  }),
};

function truncate(text: string, max: number): string {
  // Take first line only, then truncate to max chars
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= max) return firstLine;
  return firstLine.slice(0, max) + "...";
}

export function sessionLabel(s: SessionInfo): string {
  if (s.title) return truncate(s.title, 60);
  if (s.firstPrompt) return truncate(s.firstPrompt, 60);
  return s.name;
}

/** Build grouped options for react-select: Specs (meta-contexts) and Sessions (standalone). */
export function buildGroupedOptions(
  sessions: SessionInfo[],
  metaContexts: MetaContextInfo[],
): GroupBase<SessionOption>[] {
  // Collect all session IDs that belong to a meta-context
  const sessionsInMetaContexts = new Set<string>();
  for (const mc of metaContexts) {
    for (const sid of mc.sessionIds) {
      sessionsInMetaContexts.add(sid);
    }
  }

  // Build meta-context options
  const specOptions: SessionOption[] = metaContexts.map((mc) => ({
    value: `mc:${mc.id}`,
    label: mc.name,
  }));

  // Build standalone session options (those not in any meta-context)
  const standaloneOptions: SessionOption[] = sessions
    .filter((s) => !sessionsInMetaContexts.has(s.sessionId))
    .map((s) => ({
      value: s.sessionId,
      label: sessionLabel(s),
    }));

  // Build grouped options
  const groups: GroupBase<SessionOption>[] = [];
  if (specOptions.length > 0) {
    groups.push({ label: "Specs", options: specOptions });
  }
  groups.push({ label: "Sessions", options: standaloneOptions });

  return groups;
}

/** Resolve a picker selection value to a concrete session ID. */
export function resolveSelection(
  value: string,
  metaContexts: MetaContextInfo[],
): string | null {
  if (value.startsWith("mc:")) {
    const mcId = value.slice(3);
    const mc = metaContexts.find((m) => m.id === mcId);
    if (mc && mc.sessionIds.length > 0) {
      return mc.sessionIds[mc.sessionIds.length - 1];
    }
    return null;
  }
  return value;
}

export function SessionPicker({
  sessions,
  metaContexts,
  currentSessionId,
  onSwitch,
  onCreate,
  isDisabled,
}: SessionPickerProps) {
  const groupedOptions = buildGroupedOptions(sessions, metaContexts);

  // Determine current value: if session belongs to a meta-context, show the meta-context
  let currentValue: SessionOption | null = null;
  if (currentSessionId) {
    const mc = metaContexts.find((m) => m.sessionIds.includes(currentSessionId));
    if (mc) {
      currentValue = { value: `mc:${mc.id}`, label: mc.name };
    } else {
      const session = sessions.find((s) => s.sessionId === currentSessionId);
      if (session) {
        currentValue = { value: session.sessionId, label: sessionLabel(session) };
      }
    }
  }

  return (
    <CreatableSelect<SessionOption, false, GroupBase<SessionOption>>
      styles={styles}
      options={groupedOptions}
      value={currentValue}
      onChange={(option) => {
        if (!option) return;
        const resolvedId = resolveSelection(option.value, metaContexts);
        if (resolvedId && resolvedId !== currentSessionId) {
          onSwitch(resolvedId);
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
