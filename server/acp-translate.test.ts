import { describe, test, expect } from "bun:test";
import { translateAcpUpdate, stripModePreamble } from "./acp-translate.ts";
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

  test("current_mode_update → ModeChanged", () => {
    const update: SessionUpdate = {
      sessionUpdate: "current_mode_update",
      currentModeId: "plan",
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "ModeChanged", modeId: "plan" });
  });

  test("current_mode_update code → ModeChanged", () => {
    const update: SessionUpdate = {
      sessionUpdate: "current_mode_update",
      currentModeId: "code",
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "ModeChanged", modeId: "code" });
  });

  test("plan → PlanUpdated", () => {
    const update: SessionUpdate = {
      sessionUpdate: "plan",
      entries: [
        { content: "Research codebase", status: "completed", priority: "high" },
        { content: "Implement feature", status: "in_progress", priority: "medium" },
      ],
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "PlanUpdated",
      entries: [
        { content: "Research codebase", status: "completed", priority: "high" },
        { content: "Implement feature", status: "in_progress", priority: "medium" },
      ],
    });
  });

  test("agent_thought_chunk text → AgentThought", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: "Let me think..." },
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "AgentThought", text: "Let me think..." });
  });

  test("agent_thought_chunk image → empty", () => {
    const update: SessionUpdate = {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "image", data: "abc", mimeType: "image/png" },
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(0);
  });

  test("usage_update → UsageUpdated with cost", () => {
    const update: SessionUpdate = {
      sessionUpdate: "usage_update",
      size: 200000,
      used: 45000,
      cost: { amount: 0.0234, currency: "USD" },
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "UsageUpdated",
      size: 200000,
      used: 45000,
      costAmount: 0.0234,
      costCurrency: "USD",
    });
  });

  test("usage_update → UsageUpdated without cost", () => {
    const update: SessionUpdate = {
      sessionUpdate: "usage_update",
      size: 200000,
      used: 45000,
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "UsageUpdated",
      size: 200000,
      used: 45000,
    });
  });

  test("session_info_update → SessionInfoUpdated", () => {
    const update: SessionUpdate = {
      sessionUpdate: "session_info_update",
      title: "My Chat",
      updatedAt: "2026-02-19T12:00:00Z",
    };

    const events = translateAcpUpdate(update);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "SessionInfoUpdated",
      title: "My Chat",
      updatedAt: "2026-02-19T12:00:00Z",
    });
  });

  test("user_message_chunk replay strips mode preamble", () => {
    const decorated = "[Mode: Requirements]\n\nYou are in Requirements mode.\n\n[conclave:user]\n\nAnalyze login flow";
    const update: SessionUpdate = {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: decorated },
    };

    const events = translateAcpUpdate(update, true);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "PromptSubmitted", text: "Analyze login flow" });
  });
});

describe("stripModePreamble", () => {
  test("strips mode preamble from decorated prompt", () => {
    const text = "[Mode: Requirements]\n\nSome long instruction\n\n[conclave:user]\n\nUser text here";
    expect(stripModePreamble(text)).toBe("User text here");
  });

  test("returns plain text unchanged", () => {
    expect(stripModePreamble("Hello world")).toBe("Hello world");
  });

  test("returns text with --- unchanged (not a conclave marker)", () => {
    const text = "Some text\n\n---\n\nMore text";
    expect(stripModePreamble(text)).toBe("Some text\n\n---\n\nMore text");
  });

  test("handles empty user text after separator", () => {
    const text = "[Mode: Requirements]\n\nInstruction\n\n[conclave:user]\n\n";
    expect(stripModePreamble(text)).toBe("");
  });
});
