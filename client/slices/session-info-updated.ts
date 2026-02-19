import { createSlice } from "./create-slice.ts";

/** SessionInfoUpdated → updates session title in the sessions list. */
export const sessionInfoUpdatedSlice = createSlice("SessionInfoUpdated", (state, event) => {
  const sessions = state.sessions.map((s) =>
    s.sessionId === event.sessionId
      ? { ...s, title: event.title ?? s.title }
      : s,
  );
  return { ...state, sessions };
});
