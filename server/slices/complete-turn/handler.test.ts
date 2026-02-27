import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("CompleteTurn handler", () => {
  test("emits TurnCompleted event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "CompleteTurn", stopReason: "end_turn" });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("TurnCompleted");
  });
});
