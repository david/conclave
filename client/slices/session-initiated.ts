import { createSlice } from "./create-slice.ts";

/** SessionInitiated → marks session creation in progress. */
export const sessionInitiatedSlice = createSlice("SessionInitiated", (state) => {
  return { ...state, creatingSession: true };
});
