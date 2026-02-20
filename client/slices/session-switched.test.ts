import { describe, test, expect } from "bun:test";
import { sessionSwitchedSlice } from "./session-switched.ts";
import { initialState } from "../types.ts";
import type { WsEvent } from "../../server/types.ts";

const switchEvent: WsEvent = {
  type: "SessionSwitched",
  sessionId: "s2",
  seq: -1,
  timestamp: Date.now(),
};

describe("sessionSwitchedSlice", () => {
  test("resets state but preserves sessions", () => {
    const state = sessionSwitchedSlice(
      { ...initialState, sessionId: "s1", sessions: [{ sessionId: "s1", name: "Session 1", title: null, firstPrompt: "hi" }], isProcessing: true },
      switchEvent,
    );
    expect(state.sessionId).toBe("s2");
    expect(state.sessions).toHaveLength(1);
    expect(state.messages).toEqual([]);
    expect(state.isProcessing).toBe(false);
  });

  test("ignores non-SessionSwitched events", () => {
    const state = sessionSwitchedSlice(initialState, { type: "SessionInitiated" });
    expect(state).toBe(initialState);
  });
});
