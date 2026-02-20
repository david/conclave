import type { AppState, ClientEvent } from "../types.ts";

/** ModeList → sets available modes from server. */
export function modeListSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "ModeList") return state;
  return { ...state, availableModes: event.modes };
}
