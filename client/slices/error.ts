import type { AppState, ClientEvent } from "../types.ts";

/** Error → sets error message and stops processing. */
export function errorSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "Error") return state;
  return { ...state, error: event.message, isProcessing: false };
}
