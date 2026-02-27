import { describe, test, expect } from "bun:test";
import { metaContextEnsuredSlice } from "./meta-context-created.ts";
import { initialMetaContextRegistryState } from "../server-state.ts";
import type { DomainEvent } from "../types.ts";

describe("metaContextEnsuredSlice", () => {
  test("creates entry in state when created is true", () => {
    const event: DomainEvent = {
      type: "MetaContextEnsured",
      metaContextId: "mc-1",
      metaContextName: "Feature Work",
      originSessionId: "s1",
      commandText: "/plan feat",
      created: true,
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const result = metaContextEnsuredSlice(initialMetaContextRegistryState, event);

    expect(result.contexts.size).toBe(1);
    const ctx = result.contexts.get("mc-1")!;
    expect(ctx.id).toBe("mc-1");
    expect(ctx.name).toBe("Feature Work");
    expect(ctx.sessionIds).toEqual([]);

    expect(result.nameIndex.size).toBe(1);
    expect(result.nameIndex.get("Feature Work")).toBe("mc-1");
  });

  test("is no-op when created is false", () => {
    const event: DomainEvent = {
      type: "MetaContextEnsured",
      metaContextId: "mc-1",
      metaContextName: "Feature Work",
      originSessionId: "s1",
      commandText: "/plan feat",
      created: false,
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const result = metaContextEnsuredSlice(initialMetaContextRegistryState, event);
    expect(result).toBe(initialMetaContextRegistryState);
  });

  test("ignores unrelated events", () => {
    const event: DomainEvent = {
      type: "SessionCreated",
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const result = metaContextEnsuredSlice(initialMetaContextRegistryState, event);
    expect(result).toBe(initialMetaContextRegistryState);
  });

  test("does not mutate existing state", () => {
    const event: DomainEvent = {
      type: "MetaContextEnsured",
      metaContextId: "mc-1",
      metaContextName: "Feature Work",
      originSessionId: "s1",
      commandText: "/plan feat",
      created: true,
      sessionId: "s1",
      seq: 1,
      timestamp: 1000,
    };

    const before = initialMetaContextRegistryState;
    metaContextEnsuredSlice(before, event);

    expect(before.contexts.size).toBe(0);
    expect(before.nameIndex.size).toBe(0);
  });
});
