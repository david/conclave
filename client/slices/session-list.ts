import type { AppState, ClientEvent } from "../types.ts";

/** SessionList → replaces the full sessions list. */
export function sessionListSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "SessionList") return state;
  return { ...state, sessions: event.sessions };
}
