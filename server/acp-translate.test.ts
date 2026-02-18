import { describe, test, expect } from "bun:test";
import { translateAcpUpdate } from "./acp-translate.ts";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

describe("translateAcpUpdate", () => {
  test("agent_message_chunk text → AgentText", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "hello world" },
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "AgentText", text: "hello world" });
  });

  test("agent_message_chunk image → empty", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_message_chunk",
      content: { type: "image", data: "abc", mimeType: "image/png" },
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(0);
  });

  test("tool_call → ToolCallStarted", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call",
      toolCallId: "tc-1",
      title: "Read file",
      kind: "read",
      status: "pending",
      rawInput: { path: "/foo.txt" },
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "ToolCallStarted",
      toolCallId: "tc-1",
      toolName: "Read file",
      kind: "read",
      input: { path: "/foo.txt" },
    });
  });

  test("tool_call_update in_progress → ToolCallUpdated", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-1",
      status: "in_progress",
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "ToolCallUpdated",
      toolCallId: "tc-1",
      status: "in_progress",
      content: undefined,
    });
  });

  test("tool_call_update completed → ToolCallCompleted", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-1",
      status: "completed",
      rawOutput: { result: "ok" },
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "ToolCallCompleted",
      toolCallId: "tc-1",
      status: "completed",
      output: { result: "ok" },
    });
  });

  test("tool_call_update failed → ToolCallCompleted", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-1",
      status: "failed",
      rawOutput: "error msg",
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "ToolCallCompleted",
      toolCallId: "tc-1",
      status: "failed",
      output: "error msg",
    });
  });

  test("user_message_chunk → empty", () => {
    const update: SessionUpdate = {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "test" },
    };

    expect(translateAcpUpdate(update)).toHaveLength(0);
  });

  test("plan → empty", () => {
    const update: SessionUpdate = {
      sessionUpdate: "plan",
      entries: [],
    };

    expect(translateAcpUpdate(update)).toHaveLength(0);
  });
});
