import { describe, test, expect } from "bun:test";
import { toolCallStartedSlice } from "./projector.ts";
import { initialState } from "../../types.ts";
import type { AppState, ClientEvent } from "../../types.ts";

function makeToolCallStarted(overrides: Partial<{
  toolCallId: string;
  toolName: string;
  kind: string;
  input: unknown;
}>): ClientEvent {
  return {
    type: "ToolCallStarted",
    toolCallId: overrides.toolCallId ?? "tc1",
    toolName: overrides.toolName ?? "Edit",
    kind: overrides.kind ?? "edit",
    input: overrides.input ?? { file_path: "/foo.ts" },
    seq: 1,
    timestamp: Date.now(),
    sessionId: "s1",
  } as ClientEvent;
}

describe("toolCallStartedSlice", () => {
  test("adds tool call to streamingContent", () => {
    const state = toolCallStartedSlice(initialState, makeToolCallStarted({}));
    expect(state.streamingContent).toHaveLength(1);
    expect(state.streamingContent[0].type).toBe("tool_call");
  });

  test("deduplicates tool call in streamingContent", () => {
    const withExisting: AppState = {
      ...initialState,
      streamingContent: [{
        type: "tool_call",
        toolCall: {
          toolCallId: "tc1",
          toolName: "Edit",
          kind: "edit",
          input: {},
          status: "pending",
        },
      }],
    };
    const state = toolCallStartedSlice(withExisting, makeToolCallStarted({ toolCallId: "tc1" }));
    expect(state.streamingContent).toHaveLength(1);
  });

  test("ignores unrelated events", () => {
    const event = { type: "AgentText", text: "hi", seq: 1, timestamp: Date.now(), sessionId: "s1" } as ClientEvent;
    const state = toolCallStartedSlice(initialState, event);
    expect(state).toBe(initialState);
  });
});
