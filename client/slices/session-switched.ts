import { initialState } from "../types.ts";
import { createSlice } from "./create-slice.ts";

/** SessionSwitched → resets all state except the sessions list. */
export const sessionSwitchedSlice = createSlice("SessionSwitched", (state, event) => {
  return {
    ...initialState,
    sessions: state.sessions,
    sessionId: event.sessionId,
  };
});
