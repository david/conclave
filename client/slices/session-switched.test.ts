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

  test("preserves availableModes across session switch", () => {
    const modes = [
      { id: "chat", label: "Chat", color: "neutral", icon: "chat", placeholder: "Type a message..." },
      { id: "requirements", label: "Requirements", color: "purple", icon: "requirements", placeholder: "Describe..." },
    ];
    const state = sessionSwitchedSlice(
      { ...initialState, availableModes: modes },
      switchEvent,
    );
    expect(state.availableModes).toEqual(modes);
  });

  test("ignores non-SessionSwitched events", () => {
    const state = sessionSwitchedSlice(initialState, { type: "SessionInitiated" });
    expect(state).toBe(initialState);
  });
});
