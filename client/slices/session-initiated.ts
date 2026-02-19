import type { AppState, ClientEvent } from "../types.ts";

/** SessionInitiated → marks session creation in progress. */
export function sessionInitiatedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "SessionInitiated") return state;
  return { ...state, creatingSession: true };
}
