import { createSlice } from "../create-slice.ts";

/** GitStatusUpdated → replaces gitFiles with the latest file status list. */
export const gitStatusUpdatedSlice = createSlice("GitStatusUpdated", (state, event) => {
  return { ...state, gitFiles: event.files };
});
