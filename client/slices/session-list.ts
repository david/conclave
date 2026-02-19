import { createSlice } from "./create-slice.ts";

/** SessionList → replaces the full sessions list. */
export const sessionListSlice = createSlice("SessionList", (state, event) => {
  return { ...state, sessions: event.sessions };
});
