import { createSlice } from "./create-slice.ts";

/** ModeChanged → updates current mode, resets plan content on plan entry, clears pending permission. */
export const modeChangedSlice = createSlice("ModeChanged", (state, event) => {
  const currentMode = event.modeId;
  const planContent = event.modeId === "plan" ? "" : state.planContent;

  return { ...state, currentMode, planContent, pendingPermission: null };
});
