import type { AppState, ClientEvent } from "../types.ts";

/** PlanUpdated → replaces plan entries list. */
export function planUpdatedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "PlanUpdated") return state;
  return { ...state, planEntries: event.entries };
}
