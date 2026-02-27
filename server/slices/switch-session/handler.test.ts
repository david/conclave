import { describe, test, expect } from "bun:test";
import { setup, withCreatedSession, withDiscoveredSession } from "../test-helpers.ts";

describe("SwitchSession handler", () => {
  test("emits SessionSwitched with epoch", async () => {
    const { store, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "SwitchSession" });

    const events = store.getAll();
    const switched = events.find(e => e.type === "SessionSwitched");
    expect(switched).toBeDefined();
    if (switched && switched.type === "SessionSwitched") {
      expect(switched.epoch).toBeTruthy();
      expect(typeof switched.epoch).toBe("string");
    }
  });

  test("rejects unknown session", async () => {
    const { store, dispatch } = setup();
    await dispatch("nonexistent", { type: "SwitchSession" });

    const events = store.getAll();
    const error = events.find(e => e.type === "ErrorOccurred");
    expect(error).toBeDefined();
  });

  test("LoadIfUnloaded processor issues LoadSession for unloaded session", async () => {
    const { store, bridge, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "SwitchSession" });

    expect(bridge.loadSession).toHaveBeenCalledWith("s1");
    const events = store.getAll();
    const loaded = events.find(e => e.type === "SessionLoaded");
    expect(loaded).toBeDefined();
  });

  test("LoadIfUnloaded processor skips already-loaded sessions", async () => {
    const { store, bridge, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "SwitchSession" });

    expect(bridge.loadSession).not.toHaveBeenCalled();
    const events = store.getAll();
    expect(events.find(e => e.type === "SessionLoaded")).toBeUndefined();
  });
});
