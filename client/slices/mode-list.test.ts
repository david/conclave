import { describe, test, expect } from "bun:test";
import { modeListSlice } from "./mode-list.ts";
import { initialState } from "../types.ts";

describe("modeListSlice", () => {
  test("ModeList event sets availableModes", () => {
    const event = {
      type: "ModeList" as const,
      modes: [
        { id: "chat", label: "Chat", color: "neutral", icon: "chat", placeholder: "Type a message..." },
        { id: "research", label: "Research", color: "blue", icon: "search", placeholder: "Ask a question..." },
      ],
      seq: -1 as const,
      timestamp: Date.now(),
    };

    const state = modeListSlice(initialState, event);
    expect(state.availableModes).toHaveLength(2);
    expect(state.availableModes[0].id).toBe("chat");
    expect(state.availableModes[1].label).toBe("Research");
  });

  test("ignores non-ModeList events", () => {
    const event = {
      type: "SessionInitiated" as const,
    };

    const state = modeListSlice(initialState, event);
    expect(state.availableModes).toEqual([]);
  });

  test("replaces previous modes on subsequent ModeList event", () => {
    const firstModes = [
      { id: "chat", label: "Chat", color: "neutral", icon: "chat", placeholder: "msg..." },
    ];
    const stateWithModes = { ...initialState, availableModes: firstModes };

    const event = {
      type: "ModeList" as const,
      modes: [
        { id: "chat", label: "Chat", color: "neutral", icon: "chat", placeholder: "msg..." },
        { id: "design", label: "Design", color: "purple", icon: "blueprint", placeholder: "Describe..." },
      ],
      seq: -1 as const,
      timestamp: Date.now(),
    };

    const state = modeListSlice(stateWithModes, event);
    expect(state.availableModes).toHaveLength(2);
    expect(state.availableModes[1].id).toBe("design");
  });
});
