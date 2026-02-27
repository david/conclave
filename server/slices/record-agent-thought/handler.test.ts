import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordAgentThought handler", () => {
  test("emits AgentThought event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "RecordAgentThought", text: "thinking..." });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("AgentThought");
  });
});
