import type { AppState, ClientEvent } from "../types.ts";

/** SessionCreated → sets active session ID, clears creating flag. */
export function sessionCreatedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "SessionCreated") return state;
  return { ...state, sessionId: event.sessionId, creatingSession: false };
}
