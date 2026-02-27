import { createSlice } from "../create-slice.ts";

/** SessionList → replaces the full sessions list and meta-contexts. */
export const sessionListSlice = createSlice("SessionList", (state, event) => {
  return { ...state, sessions: event.sessions, metaContexts: event.metaContexts ?? [] };
});
