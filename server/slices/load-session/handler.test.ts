import { describe, test, expect } from "bun:test";
import { setup, withDiscoveredSession } from "../test-helpers.ts";

describe("LoadSession handler", () => {
  test("calls bridge and emits SessionLoaded", async () => {
    const { store, bridge, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "LoadSession" });

    expect(bridge.loadSession).toHaveBeenCalledWith("s1");
    const events = store.getAll();
    const loaded = events.find(e => e.type === "SessionLoaded");
    expect(loaded).toBeDefined();
  });

  test("does not emit synthetic TurnCompleted", async () => {
    const { store, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "LoadSession" });

    const events = store.getAll();
    expect(events.find(e => e.type === "TurnCompleted")).toBeUndefined();
  });
});
