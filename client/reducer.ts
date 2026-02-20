import { useState, useCallback } from "react";
import { combinedReducer } from "./slices/index.ts";
import { initialState } from "./types.ts";
import type { ClientEvent, AppState } from "./types.ts";

// Re-export all types so existing consumers don't need to change imports
export type {
  ToolCallInfo,
  SessionInfo,
  PlanEntryInfo,
  UseCase,
  FileChangeAction,
  FileChangeInfo,
  TextBlock,
  ImageBlock,
  ToolCallBlock,
  ThoughtBlock,
  ContentBlock,
  Message,
  UsageInfo,
  AppState,
  ClientEvent,
} from "./types.ts";

export { initialState } from "./types.ts";

export function applyEvent(state: AppState, event: ClientEvent): AppState {
  return combinedReducer(state, event);
}

export function fold(events: ClientEvent[]): AppState {
  return events.reduce(applyEvent, initialState);
}

export function useEventStore() {
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [state, setState] = useState<AppState>(initialState);

  const append = useCallback((event: ClientEvent) => {
    setEvents((prev) => {
      // On session switch, clear the log (keep SessionList meta-events)
      if (event.type === "SessionSwitched") {
        return [...prev.filter((e) => e.type === "SessionList" || e.type === "ModeList"), event];
      }
      return [...prev, event];
    });
    setState((prev) => applyEvent(prev, event));
  }, []);

  return { state, events, append };
}
