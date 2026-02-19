import { createSlice } from "./create-slice.ts";

/** Error → sets error message and stops processing. */
export const errorSlice = createSlice("Error", (state, event) => {
  return { ...state, error: event.message, isProcessing: false };
});
