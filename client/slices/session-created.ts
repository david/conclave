import { createSlice } from "./create-slice.ts";

/** SessionCreated → sets active session ID, clears creating flag. */
export const sessionCreatedSlice = createSlice("SessionCreated", (state, event) => {
  return { ...state, sessionId: event.sessionId, creatingSession: false };
});
