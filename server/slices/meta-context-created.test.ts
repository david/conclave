import { describe, test, expect } from "bun:test";
import { metaContextCreatedSlice } from "./meta-context-created.ts";
import { initialMetaContextRegistryState } from "../server-state.ts";
import type { DomainEvent } from "../types.ts";

describe("metaContextCreatedSlice", () => {
  test("creates entry in state from MetaContextCreated event", () => {
    const event: DomainEvent = {
      type: "MetaContextCreated",
      metaContextId: "mc-1",
      name: "Feature Work",
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const result = metaContextCreatedSlice(initialMetaContextRegistryState, event);

    expect(result.contexts.size).toBe(1);
    const ctx = result.contexts.get("mc-1")!;
    expect(ctx.id).toBe("mc-1");
    expect(ctx.name).toBe("Feature Work");
    expect(ctx.sessionIds).toEqual([]);

    expect(result.nameIndex.size).toBe(1);
    expect(result.nameIndex.get("Feature Work")).toBe("mc-1");
  });

  test("ignores unrelated events", () => {
    const event: DomainEvent = {
      type: "SessionCreated",
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const result = metaContextCreatedSlice(initialMetaContextRegistryState, event);
    expect(result).toBe(initialMetaContextRegistryState);
  });

  test("does not mutate existing state", () => {
    const event: DomainEvent = {
      type: "MetaContextCreated",
      metaContextId: "mc-1",
      name: "Feature Work",
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const before = initialMetaContextRegistryState;
    metaContextCreatedSlice(before, event);

    expect(before.contexts.size).toBe(0);
    expect(before.nameIndex.size).toBe(0);
  });
});
