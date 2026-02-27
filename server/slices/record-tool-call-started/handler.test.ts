import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordToolCallStarted handler", () => {
  test("emits ToolCallStarted event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordToolCallStarted",
      toolCallId: "tc-1",
      toolName: "Read",
      kind: "read",
      input: { path: "/foo" },
    });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ToolCallStarted");
  });
});
