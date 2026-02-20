import { createSlice } from "./create-slice.ts";

/** ModeChanged → updates current mode, clears file changes when leaving implement mode. */
export const modeChangedSlice = createSlice("ModeChanged", (state, event) => {
  const currentMode = event.modeId;
  // Clear file changes when switching away from implement mode
  const fileChanges = event.modeId === "implement" ? state.fileChanges : [];

  return { ...state, currentMode, fileChanges };
});
