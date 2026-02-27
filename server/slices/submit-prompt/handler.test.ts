import { describe, test, expect } from "bun:test";
import { setup, withCreatedSession, withDiscoveredSession } from "../test-helpers.ts";

describe("SubmitPrompt handler", () => {
  test("emits PromptSubmitted and calls bridge", async () => {
    const { store, bridge, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "SubmitPrompt", text: "hello" });

    const events = store.getAll();
    const prompt = events.find(e => e.type === "PromptSubmitted");
    expect(prompt).toBeDefined();
    if (prompt && prompt.type === "PromptSubmitted") {
      expect(prompt.text).toBe("hello");
    }
    expect(bridge.submitPrompt).toHaveBeenCalledWith("s1", "hello", undefined, true);
  });

  test("rejects unloaded session", async () => {
    const { store, bridge, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "SubmitPrompt", text: "hello" });

    const events = store.getAll();
    expect(events.find(e => e.type === "PromptSubmitted")).toBeUndefined();
    const error = events.find(e => e.type === "ErrorOccurred");
    expect(error).toBeDefined();
    expect(bridge.submitPrompt).not.toHaveBeenCalled();
  });
});
