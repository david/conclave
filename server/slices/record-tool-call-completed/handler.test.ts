import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordToolCallCompleted handler", () => {
  test("emits ToolCallCompleted event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordToolCallCompleted",
      toolCallId: "tc-1",
      status: "completed",
      output: "done",
    });

    expect(store.getAll()[0].type).toBe("ToolCallCompleted");
  });
});
