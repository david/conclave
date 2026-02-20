import { describe, test, expect } from "bun:test";
import { modeChangedSlice } from "./mode-changed.ts";
import { initialState } from "../types.ts";
import type { ClientEvent } from "../types.ts";

function makeModeChanged(modeId: string): ClientEvent {
  return {
    type: "ModeChanged",
    modeId,
    seq: 1,
    timestamp: Date.now(),
    sessionId: "s1",
  };
}

describe("modeChangedSlice", () => {
  test("updates currentMode", () => {
    const state = modeChangedSlice(initialState, makeModeChanged("research"));
    expect(state.currentMode).toBe("research");
  });

  test("clears fileChanges when switching to non-implement mode", () => {
    const stateWithFiles = {
      ...initialState,
      currentMode: "implement",
      fileChanges: [
        { filePath: "/a.ts", action: "modified" as const, toolCallId: "tc1", status: "completed" },
      ],
    };
    const state = modeChangedSlice(stateWithFiles, makeModeChanged("research"));
    expect(state.fileChanges).toEqual([]);
  });

  test("preserves fileChanges when switching to implement mode", () => {
    const files = [
      { filePath: "/a.ts", action: "modified" as const, toolCallId: "tc1", status: "completed" },
    ];
    const stateWithFiles = { ...initialState, fileChanges: files };
    const state = modeChangedSlice(stateWithFiles, makeModeChanged("implement"));
    expect(state.fileChanges).toEqual(files);
  });

  test("ignores non-ModeChanged events", () => {
    const event: ClientEvent = {
      type: "AgentText",
      text: "hello",
      seq: 1,
      timestamp: Date.now(),
      sessionId: "s1",
    };
    const state = modeChangedSlice(initialState, event);
    expect(state).toBe(initialState);
  });
});
