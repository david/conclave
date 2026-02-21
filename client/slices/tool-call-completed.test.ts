import { describe, test, expect } from "bun:test";
import { toolCallCompletedSlice } from "./tool-call-completed.ts";
import { initialState } from "../types.ts";
import type { AppState, ClientEvent } from "../types.ts";

function makeToolCallCompleted(overrides: Partial<{
  toolCallId: string;
  status: string;
  output: unknown;
}>): ClientEvent {
  return {
    type: "ToolCallCompleted",
    toolCallId: overrides.toolCallId ?? "tc1",
    status: overrides.status ?? "completed",
    output: overrides.output ?? "done",
    seq: 1,
    timestamp: Date.now(),
    sessionId: "s1",
  } as ClientEvent;
}

describe("toolCallCompletedSlice", () => {
  test("updates tool call status in streamingContent", () => {
    const withToolCall: AppState = {
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
    const state = toolCallCompletedSlice(withToolCall, makeToolCallCompleted({}));
    expect(state.streamingContent[0].type).toBe("tool_call");
    if (state.streamingContent[0].type === "tool_call") {
      expect(state.streamingContent[0].toolCall.status).toBe("completed");
      expect(state.streamingContent[0].toolCall.output).toBe("done");
    }
  });

  test("ignores unrelated events", () => {
    const event = { type: "AgentText", text: "hi", seq: 1, timestamp: Date.now(), sessionId: "s1" } as ClientEvent;
    const state = toolCallCompletedSlice(initialState, event);
    expect(state).toBe(initialState);
  });
});
