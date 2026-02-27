import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("DiscoverSession handler", () => {
  test("emits SessionDiscovered event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "DiscoverSession",
      name: "Session 1",
      title: "My Title",
      createdAt: 1000,
    });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("SessionDiscovered");
    if (events[0].type === "SessionDiscovered") {
      expect(events[0].name).toBe("Session 1");
      expect(events[0].title).toBe("My Title");
      expect(events[0].createdAt).toBe(1000);
    }
  });
});
