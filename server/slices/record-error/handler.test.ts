import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordError handler", () => {
  test("emits ErrorOccurred event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "RecordError", message: "something broke" });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ErrorOccurred");
    if (events[0].type === "ErrorOccurred") {
      expect(events[0].message).toBe("something broke");
    }
  });
});
