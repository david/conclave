import { describe, test, expect } from "bun:test";
import { sessionListSlice } from "./session-list.ts";
import { initialState } from "../types.ts";
import type { MetaContextInfo } from "../types.ts";
import type { SessionListEvent } from "../../server/types.ts";

function makeSessionListEvent(overrides: Partial<SessionListEvent> = {}): SessionListEvent {
  return {
    type: "SessionList",
    sessions: [],
    metaContexts: [],
    seq: -1,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("sessionListSlice", () => {
  test("stores sessions from SessionList event", () => {
    const sessions = [
      { sessionId: "s1", name: "Session 1", title: null, firstPrompt: "hello" },
    ];
    const event = makeSessionListEvent({ sessions });
    const state = sessionListSlice(initialState, event);
    expect(state.sessions).toEqual(sessions);
  });

  test("stores metaContexts from SessionList event", () => {
    const metaContexts: MetaContextInfo[] = [
      { id: "mc1", name: "Feature A", sessionIds: ["s1", "s2"] },
      { id: "mc2", name: "Feature B", sessionIds: ["s3"] },
    ];
    const event = makeSessionListEvent({ metaContexts });
    const state = sessionListSlice(initialState, event);
    expect(state.metaContexts).toEqual(metaContexts);
  });

  test("defaults metaContexts to empty array when not provided", () => {
    // Simulate an older server that doesn't send metaContexts
    const event = makeSessionListEvent();
    // Remove metaContexts to simulate missing field
    const eventWithout = { ...event } as any;
    delete eventWithout.metaContexts;
    const state = sessionListSlice(initialState, eventWithout);
    expect(state.metaContexts).toEqual([]);
  });

  test("replaces previous metaContexts on new SessionList event", () => {
    const mc1: MetaContextInfo[] = [{ id: "mc1", name: "Old", sessionIds: ["s1"] }];
    const mc2: MetaContextInfo[] = [{ id: "mc2", name: "New", sessionIds: ["s2"] }];

    const state1 = sessionListSlice(initialState, makeSessionListEvent({ metaContexts: mc1 }));
    expect(state1.metaContexts).toEqual(mc1);

    const state2 = sessionListSlice(state1, makeSessionListEvent({ metaContexts: mc2 }));
    expect(state2.metaContexts).toEqual(mc2);
  });

  test("ignores non-SessionList events", () => {
    const state = sessionListSlice(initialState, { type: "SessionInitiated" });
    expect(state).toBe(initialState);
  });
});
