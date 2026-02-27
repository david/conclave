import { describe, test, expect } from "bun:test";
import { sessionAddedToMetaContextSlice } from "./reducer.ts";
import type { MetaContextRegistryState } from "../../server-state.ts";
import type { DomainEvent } from "../../types.ts";

function stateWithContext(): MetaContextRegistryState {
  const contexts = new Map();
  contexts.set("mc-1", { id: "mc-1", name: "Feature Work", sessionIds: ["s1"] });
  const nameIndex = new Map();
  nameIndex.set("Feature Work", "mc-1");
  return { contexts, nameIndex };
}

describe("sessionAddedToMetaContextSlice", () => {
  test("appends session ID to existing context", () => {
    const state = stateWithContext();
    const event: DomainEvent = {
      type: "SessionAddedToMetaContext",
      metaContextId: "mc-1",
      commandText: "/plan feat",
      sessionId: "s2",
      seq: 2,
      timestamp: 2000,
    };

    const result = sessionAddedToMetaContextSlice(state, event);

    const ctx = result.contexts.get("mc-1")!;
    expect(ctx.sessionIds).toEqual(["s1", "s2"]);
  });

  test("ignores unrelated events", () => {
    const state = stateWithContext();
    const event: DomainEvent = {
      type: "SessionCreated",
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const result = sessionAddedToMetaContextSlice(state, event);
    expect(result).toBe(state);
  });

  test("ignores events for unknown meta-context IDs", () => {
    const state = stateWithContext();
    const event: DomainEvent = {
      type: "SessionAddedToMetaContext",
      metaContextId: "mc-unknown",
      commandText: "/plan feat",
      sessionId: "s2",
      seq: 2,
      timestamp: 2000,
    };

    const result = sessionAddedToMetaContextSlice(state, event);
    expect(result).toBe(state);
  });

  test("does not mutate existing state", () => {
    const state = stateWithContext();
    const event: DomainEvent = {
      type: "SessionAddedToMetaContext",
      metaContextId: "mc-1",
      commandText: "/plan feat",
      sessionId: "s2",
      seq: 2,
      timestamp: 2000,
    };

    sessionAddedToMetaContextSlice(state, event);

    // Original state should be unchanged
    expect(state.contexts.get("mc-1")!.sessionIds).toEqual(["s1"]);
  });
});
