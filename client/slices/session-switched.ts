import { initialState } from "../types.ts";
import { createSlice } from "./create-slice.ts";

/** SessionSwitched → resets all state except the sessions list and global data. */
export const sessionSwitchedSlice = createSlice("SessionSwitched", (state, event) => {
  return {
    ...initialState,
    sessions: state.sessions,
    specs: state.specs,
    gitFiles: state.gitFiles,
    metaContexts: state.metaContexts,
    sessionId: event.sessionId,
  };
});
