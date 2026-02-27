import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordAgentText handler", () => {
  test("emits AgentText event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "RecordAgentText", text: "hello" });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("AgentText");
    if (events[0].type === "AgentText") {
      expect(events[0].text).toBe("hello");
    }
    expect("sessionId" in events[0] && events[0].sessionId).toBe("s1");
  });

  test("does not invoke processors for non-matching events", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "RecordAgentText", text: "hello" });

    // Only the AgentText event should be in the store — no processor side effects
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].type).toBe("AgentText");
  });
});
