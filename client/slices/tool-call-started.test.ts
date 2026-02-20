import { describe, test, expect } from "bun:test";
import { toolCallStartedSlice } from "./tool-call-started.ts";
import { initialState } from "../types.ts";
import type { AppState, ClientEvent } from "../types.ts";

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

  test("tracks file change for edit kind", () => {
    const state = toolCallStartedSlice(initialState, makeToolCallStarted({
      kind: "edit",
      input: { file_path: "/src/app.ts" },
    }));
    expect(state.fileChanges).toHaveLength(1);
    expect(state.fileChanges[0]).toEqual({
      filePath: "/src/app.ts",
      action: "modified",
      toolCallId: "tc1",
      status: "pending",
    });
  });

  test("tracks file change for delete kind", () => {
    const state = toolCallStartedSlice(initialState, makeToolCallStarted({
      kind: "delete",
      input: { file_path: "/old.ts" },
    }));
    expect(state.fileChanges).toHaveLength(1);
    expect(state.fileChanges[0].action).toBe("deleted");
  });

  test("extracts file path from 'path' key", () => {
    const state = toolCallStartedSlice(initialState, makeToolCallStarted({
      kind: "edit",
      input: { path: "/via-path.ts" },
    }));
    expect(state.fileChanges).toHaveLength(1);
    expect(state.fileChanges[0].filePath).toBe("/via-path.ts");
  });

  test("ignores read kind for file changes", () => {
    const state = toolCallStartedSlice(initialState, makeToolCallStarted({
      kind: "read",
      input: { file_path: "/foo.ts" },
    }));
    expect(state.fileChanges).toHaveLength(0);
    // But still adds to streamingContent
    expect(state.streamingContent).toHaveLength(1);
  });

  test("ignores tool calls without file path for file changes", () => {
    const state = toolCallStartedSlice(initialState, makeToolCallStarted({
      kind: "edit",
      input: { query: "search term" },
    }));
    expect(state.fileChanges).toHaveLength(0);
  });

  test("filters out .claude/plans/ paths from file changes", () => {
    const state = toolCallStartedSlice(initialState, makeToolCallStarted({
      kind: "edit",
      input: { file_path: "/home/user/.claude/plans/plan.md" },
    }));
    expect(state.fileChanges).toHaveLength(0);
  });

  test("updates existing file change entry on re-edit", () => {
    const withExisting: AppState = {
      ...initialState,
      fileChanges: [{
        filePath: "/foo.ts",
        action: "modified",
        toolCallId: "tc-old",
        status: "completed",
      }],
    };
    const state = toolCallStartedSlice(withExisting, makeToolCallStarted({
      toolCallId: "tc-new",
      kind: "edit",
      input: { file_path: "/foo.ts" },
    }));
    expect(state.fileChanges).toHaveLength(1);
    expect(state.fileChanges[0].toolCallId).toBe("tc-new");
    expect(state.fileChanges[0].status).toBe("pending");
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
