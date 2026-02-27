import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordPlanUpdated handler", () => {
  test("emits PlanUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordPlanUpdated",
      entries: [{ content: "task", status: "pending", priority: "high" }],
    });

    expect(store.getAll()[0].type).toBe("PlanUpdated");
  });
});
