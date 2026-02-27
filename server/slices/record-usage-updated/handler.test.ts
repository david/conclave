import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordUsageUpdated handler", () => {
  test("emits UsageUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordUsageUpdated",
      size: 200000,
      used: 50000,
    });

    expect(store.getAll()[0].type).toBe("UsageUpdated");
  });
});
