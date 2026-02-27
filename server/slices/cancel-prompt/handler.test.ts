import { describe, test, expect } from "bun:test";
import { setup, withCreatedSession } from "../test-helpers.ts";

describe("CancelPrompt handler", () => {
  test("emits CancellationRequested and calls bridge", async () => {
    const { store, bridge, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "CancelPrompt" });

    const events = store.getAll();
    const cancel = events.find(e => e.type === "CancellationRequested");
    expect(cancel).toBeDefined();
    expect(bridge.cancel).toHaveBeenCalledWith("s1");
  });
});
