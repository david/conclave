import { describe, test, expect } from "bun:test";
import { translateAcpToCommands } from "./acp-translate.ts";
import type { SessionUpdate } from "@agentclientprotocol/sdk";

describe("translateAcpToCommands", () => {
  test("agent_message_chunk text → RecordAgentText", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "hello world" },
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({ type: "RecordAgentText", text: "hello world" });
  });

  test("agent_message_chunk image → empty", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_message_chunk",
      content: { type: "image", data: "abc", mimeType: "image/png" },
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(0);
  });

  test("tool_call → RecordToolCallStarted", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call",
      toolCallId: "tc-1",
      title: "Read file",
      kind: "read",
      status: "pending",
      rawInput: { path: "/foo.txt" },
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordToolCallStarted",
      toolCallId: "tc-1",
      toolName: "Read file",
      kind: "read",
      input: { path: "/foo.txt" },
    });
  });

  test("tool_call_update in_progress → RecordToolCallUpdated", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-1",
      status: "in_progress",
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordToolCallUpdated",
      toolCallId: "tc-1",
      status: "in_progress",
      content: undefined,
    });
  });

  test("tool_call_update completed → RecordToolCallCompleted", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-1",
      status: "completed",
      rawOutput: { result: "ok" },
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordToolCallCompleted",
      toolCallId: "tc-1",
      status: "completed",
      output: { result: "ok" },
    });
  });

  test("tool_call_update failed → RecordToolCallCompleted", () => {
    const update: SessionUpdate = {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc-1",
      status: "failed",
      rawOutput: "error msg",
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordToolCallCompleted",
      toolCallId: "tc-1",
      status: "failed",
      output: "error msg",
    });
  });

  test("user_message_chunk → empty (not replay)", () => {
    const update: SessionUpdate = {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "test" },
    };

    expect(translateAcpToCommands(update)).toHaveLength(0);
  });

  test("current_mode_update → empty (ignored)", () => {
    const update: SessionUpdate = {
      sessionUpdate: "current_mode_update",
      currentModeId: "plan",
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(0);
  });

  test("plan → RecordPlanUpdated", () => {
    const update: SessionUpdate = {
      sessionUpdate: "plan",
      entries: [
        { content: "Research codebase", status: "completed", priority: "high" },
        { content: "Implement feature", status: "in_progress", priority: "medium" },
      ],
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordPlanUpdated",
      entries: [
        { content: "Research codebase", status: "completed", priority: "high" },
        { content: "Implement feature", status: "in_progress", priority: "medium" },
      ],
    });
  });

  test("agent_thought_chunk text → RecordAgentThought", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: "Let me think..." },
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({ type: "RecordAgentThought", text: "Let me think..." });
  });

  test("agent_thought_chunk image → empty", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "image", data: "abc", mimeType: "image/png" },
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(0);
  });

  test("usage_update → RecordUsageUpdated with cost", () => {
    const update: SessionUpdate = {
      sessionUpdate: "usage_update",
      size: 200000,
      used: 45000,
      cost: { amount: 0.0234, currency: "USD" },
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordUsageUpdated",
      size: 200000,
      used: 45000,
      costAmount: 0.0234,
      costCurrency: "USD",
    });
  });

  test("usage_update → RecordUsageUpdated without cost", () => {
    const update: SessionUpdate = {
      sessionUpdate: "usage_update",
      size: 200000,
      used: 45000,
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordUsageUpdated",
      size: 200000,
      used: 45000,
    });
  });

  test("session_info_update → RecordSessionInfoUpdated", () => {
    const update: SessionUpdate = {
      sessionUpdate: "session_info_update",
      title: "My Chat",
      updatedAt: "2026-02-19T12:00:00Z",
    };

    const cmds = translateAcpToCommands(update);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({
      type: "RecordSessionInfoUpdated",
      title: "My Chat",
      updatedAt: "2026-02-19T12:00:00Z",
    });
  });

  test("user_message_chunk replay passes text through as PromptSubmitted event payload", () => {
    const update: SessionUpdate = {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "Analyze login flow" },
    };

    // During replay, returns EventPayload (not command) — handled differently by bridge
    const cmds = translateAcpToCommands(update, true);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toEqual({ type: "PromptSubmitted", text: "Analyze login flow" });
  });
});
