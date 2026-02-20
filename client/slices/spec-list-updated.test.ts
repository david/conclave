import { describe, test, expect } from "bun:test";
import { specListUpdatedSlice } from "./spec-list-updated.ts";
import { initialState } from "../types.ts";
import type { SpecInfo } from "../types.ts";

describe("specListUpdatedSlice", () => {
  test("SpecListUpdated replaces state.specs", () => {
    const specs: SpecInfo[] = [
      { name: "feat-a", description: "Feature A", phase: "analysis", type: "spec", epic: null },
      { name: "feat-b", description: null, phase: "implementation", type: "spec", epic: "my-epic" },
    ];

    const result = specListUpdatedSlice(initialState, {
      type: "SpecListUpdated",
      specs,
      seq: 1,
      timestamp: Date.now(),
    });

    expect(result.specs).toEqual(specs);
  });

  test("ignores other event types", () => {
    const existingSpecs: SpecInfo[] = [{ name: "existing", description: null, phase: null, type: "spec", epic: null }];
    const state = { ...initialState, specs: existingSpecs };
    const result = specListUpdatedSlice(state, {
      type: "AgentText",
      text: "hello",
      seq: 1,
      timestamp: Date.now(),
      sessionId: "s1",
    });

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].name).toBe("existing");
  });
});
