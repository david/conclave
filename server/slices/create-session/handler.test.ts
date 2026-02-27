import { describe, test, expect, mock } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("CreateSession handler", () => {
  test("calls bridge and emits SessionCreated", async () => {
    const { store, bridge, dispatch } = setup();
    await dispatch("_", { type: "CreateSession" });

    expect(bridge.createSession).toHaveBeenCalled();
    const events = store.getAll();
    const sessionCreated = events.find(e => e.type === "SessionCreated");
    expect(sessionCreated).toBeDefined();
    if (sessionCreated && "sessionId" in sessionCreated) {
      expect(sessionCreated.sessionId).toBe("new-session-id");
    }
  });

  test("AutoSwitchAfterCreate processor issues SwitchSession on SessionCreated", async () => {
    const { store, dispatch } = setup();
    await dispatch("_", { type: "CreateSession" });

    const events = store.getAll();
    const switched = events.find(e => e.type === "SessionSwitched");
    expect(switched).toBeDefined();
    if (switched && "sessionId" in switched) {
      expect(switched.sessionId).toBe("new-session-id");
    }
  });
});
