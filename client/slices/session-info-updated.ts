import type { AppState, ClientEvent } from "../types.ts";

/** SessionInfoUpdated → updates session title in the sessions list. */
export function sessionInfoUpdatedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "SessionInfoUpdated") return state;

  const sessions = state.sessions.map((s) =>
    s.sessionId === event.sessionId
      ? { ...s, title: event.title ?? s.title }
      : s,
  );
  return { ...state, sessions };
}
