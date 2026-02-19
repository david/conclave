import type { AppState, ClientEvent } from "../types.ts";
import { initialState } from "../types.ts";

/** SessionSwitched → resets all state except the sessions list. */
export function sessionSwitchedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "SessionSwitched") return state;
  return {
    ...initialState,
    sessions: state.sessions,
    sessionId: event.sessionId,
  };
}
