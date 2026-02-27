import { createSlice } from "./create-slice.ts";

/** ErrorOccurred → sets error message and stops processing. */
export const errorSlice = createSlice("ErrorOccurred", (state, event) => {
  return { ...state, error: event.message, isProcessing: false };
});
