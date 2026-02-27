import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordToolCallUpdated handler", () => {
  test("emits ToolCallUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordToolCallUpdated",
      toolCallId: "tc-1",
      status: "in_progress",
    });

    expect(store.getAll()[0].type).toBe("ToolCallUpdated");
  });
});
