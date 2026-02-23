import { describe, test, expect } from "bun:test";
import { turnCompletedSlice } from "./turn-completed.ts";
import { initialState } from "../types.ts";
import type { ClientEvent } from "../types.ts";

const turnCompletedEvent: ClientEvent = {
  type: "TurnCompleted",
  stopReason: "end_turn",
  seq: 1,
  timestamp: 0,
  sessionId: "s1",
} as ClientEvent;

describe("turnCompletedSlice", () => {
  test("TurnCompleted with non-empty streamingContent flushes content into assistant message", () => {
    // Arrange
    const state = {
      ...initialState,
      streamingContent: [{ type: "text" as const, text: "hello" }],
      isProcessing: true,
    };

    // Act
    const next = turnCompletedSlice(state, turnCompletedEvent);

    // Assert
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
    });
    expect(next.streamingContent).toEqual([]);
    expect(next.isProcessing).toBe(false);
  });

  test("TurnCompleted with empty streamingContent produces fallback assistant message", () => {
    // Arrange
    const state = {
      ...initialState,
      streamingContent: [],
      isProcessing: true,
    };

    // Act
    const next = turnCompletedSlice(state, turnCompletedEvent);

    // Assert
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "(No response from agent)" }],
    });
    expect(next.streamingContent).toEqual([]);
    expect(next.isProcessing).toBe(false);
  });
});
