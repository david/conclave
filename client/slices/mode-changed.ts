import type { AppState, ClientEvent } from "../types.ts";

/** ModeChanged → updates current mode, resets plan content on plan entry, clears pending permission. */
export function modeChangedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "ModeChanged") return state;

  const currentMode = event.modeId;
  const planContent = event.modeId === "plan" ? "" : state.planContent;

  return { ...state, currentMode, planContent, pendingPermission: null };
}
