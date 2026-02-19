import { describe, test, expect } from "bun:test";
import { reducer, initialState } from "./reducer.ts";
import type { DomainEvent, WsEvent } from "../server/types.ts";

function makeEvent<T extends DomainEvent["type"]>(
  type: T,
  payload: Omit<Extract<DomainEvent, { type: T }>, "seq" | "timestamp" | "type" | "sessionId">,
  seq = 1,
): Extract<DomainEvent, { type: T }> {
  return { type, seq, timestamp: Date.now(), sessionId: "s1", ...payload } as any;
}

describe("reducer", () => {
  test("SessionCreated sets sessionId", () => {
    const event = makeEvent("SessionCreated", {});
    const state = reducer(initialState, event);
    expect(state.sessionId).toBe("s1");
  });

  test("PromptSubmitted appends user message and sets isProcessing", () => {
    const event = makeEvent("PromptSubmitted", { text: "hello" });
    const state = reducer(initialState, event);

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "hello" }],
    });
    expect(state.isProcessing).toBe(true);
    expect(state.error).toBeNull();
  });

  test("AgentText chunks accumulate into streamingContent", () => {
    let state = reducer(initialState, makeEvent("AgentText", { text: "hel" }));
    state = reducer(state, makeEvent("AgentText", { text: "lo " }, 2));
    state = reducer(state, makeEvent("AgentText", { text: "world" }, 3));

    expect(state.streamingContent).toEqual([
      { type: "text", text: "hello world" },
    ]);
  });

  test("TurnCompleted flushes accumulated text into finalized message", () => {
    let state = reducer(
      initialState,
      makeEvent("PromptSubmitted", { text: "hi" }),
    );
    state = reducer(state, makeEvent("AgentText", { text: "hello" }, 2));
    state = reducer(
      state,
      makeEvent("TurnCompleted", { stopReason: "end_turn" }, 3),
    );

    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
    });
    expect(state.streamingContent).toEqual([]);
    expect(state.isProcessing).toBe(false);
  });

  test("tool call lifecycle: Started → Updated → Completed", () => {
    let state = reducer(
      initialState,
      makeEvent("ToolCallStarted", {
        toolCallId: "tc1",
        toolName: "Read",
        kind: "read",
        input: { path: "/foo" },
      }),
    );

    expect(state.streamingContent).toHaveLength(1);
    const block = state.streamingContent[0];
    expect(block.type).toBe("tool_call");
    if (block.type === "tool_call") {
      expect(block.toolCall.status).toBe("pending");
    }

    state = reducer(
      state,
      makeEvent("ToolCallUpdated", {
        toolCallId: "tc1",
        status: "in_progress",
      }, 2),
    );
    const updated = state.streamingContent[0];
    if (updated.type === "tool_call") {
      expect(updated.toolCall.status).toBe("in_progress");
    }

    state = reducer(
      state,
      makeEvent("ToolCallCompleted", {
        toolCallId: "tc1",
        status: "completed",
        output: "file contents",
      }, 3),
    );
    const completed = state.streamingContent[0];
    if (completed.type === "tool_call") {
      expect(completed.toolCall.status).toBe("completed");
      expect(completed.toolCall.output).toBe("file contents");
    }
  });

  test("TurnCompleted includes tool calls in finalized message", () => {
    let state = reducer(
      initialState,
      makeEvent("PromptSubmitted", { text: "read it" }),
    );
    state = reducer(
      state,
      makeEvent("AgentText", { text: "reading..." }, 2),
    );
    state = reducer(
      state,
      makeEvent("ToolCallStarted", {
        toolCallId: "tc1",
        toolName: "Read",
        kind: "read",
        input: { path: "/foo" },
      }, 3),
    );
    state = reducer(
      state,
      makeEvent("ToolCallCompleted", {
        toolCallId: "tc1",
        status: "completed",
        output: "contents",
      }, 4),
    );
    state = reducer(
      state,
      makeEvent("TurnCompleted", { stopReason: "end_turn" }, 5),
    );

    expect(state.messages).toHaveLength(2);
    const assistantMsg = state.messages[1];
    expect(assistantMsg.role).toBe("assistant");
    expect(assistantMsg.content).toHaveLength(2);
    expect(assistantMsg.content[0]).toEqual({
      type: "text",
      text: "reading...",
    });
    expect(assistantMsg.content[1].type).toBe("tool_call");
    if (assistantMsg.content[1].type === "tool_call") {
      expect(assistantMsg.content[1].toolCall.toolName).toBe("Read");
    }
    expect(state.streamingContent).toEqual([]);
  });

  test("Error sets error and clears isProcessing", () => {
    let state = reducer(
      initialState,
      makeEvent("PromptSubmitted", { text: "hi" }),
    );
    expect(state.isProcessing).toBe(true);

    state = reducer(state, makeEvent("Error", { message: "boom" }, 2));
    expect(state.error).toBe("boom");
    expect(state.isProcessing).toBe(false);
  });

  test("SessionSwitched resets state but preserves sessions", () => {
    let state = reducer(initialState, makeEvent("PromptSubmitted", { text: "hi" }));
    state = { ...state, sessions: [{ sessionId: "s1", name: "Session 1", title: null, firstPrompt: "hi" }] };

    const switchEvent: WsEvent = {
      type: "SessionSwitched",
      sessionId: "s2",
      seq: -1,
      timestamp: Date.now(),
    };
    state = reducer(state, switchEvent);

    expect(state.sessionId).toBe("s2");
    expect(state.messages).toHaveLength(0);
    expect(state.sessions).toHaveLength(1);
  });

  test("SessionList updates sessions array", () => {
    const event: WsEvent = {
      type: "SessionList",
      sessions: [
        { sessionId: "s1", name: "Session 1", title: "My Session", firstPrompt: "hi" },
        { sessionId: "s2", name: "Session 2", title: null, firstPrompt: null },
      ],
      seq: -1,
      timestamp: Date.now(),
    };
    const state = reducer(initialState, event);
    expect(state.sessions).toHaveLength(2);
    expect(state.sessions[0].title).toBe("My Session");
  });

  test("full replay produces correct final state", () => {
    const events: DomainEvent[] = [
      makeEvent("SessionCreated", {}),
      makeEvent("PromptSubmitted", { text: "what is 2+2?" }, 2),
      makeEvent("AgentText", { text: "The answer " }, 3),
      makeEvent("AgentText", { text: "is 4." }, 4),
      makeEvent("TurnCompleted", { stopReason: "end_turn" }, 5),
      makeEvent("PromptSubmitted", { text: "thanks" }, 6),
      makeEvent("AgentText", { text: "You're welcome!" }, 7),
      makeEvent("TurnCompleted", { stopReason: "end_turn" }, 8),
    ];

    const state = events.reduce(reducer, initialState);

    expect(state.sessionId).toBe("s1");
    expect(state.messages).toHaveLength(4);
    expect(state.messages[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "what is 2+2?" }],
    });
    expect(state.messages[1]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "The answer is 4." }],
    });
    expect(state.messages[2]).toEqual({
      role: "user",
      content: [{ type: "text", text: "thanks" }],
    });
    expect(state.messages[3]).toEqual({
      role: "assistant",
      content: [{ type: "text", text: "You're welcome!" }],
    });
    expect(state.isProcessing).toBe(false);
    expect(state.streamingContent).toEqual([]);
  });

  test("ModeChanged to plan sets currentMode and clears plan state", () => {
    const state = reducer(
      { ...initialState, planContent: "old plan" },
      makeEvent("ModeChanged", { modeId: "plan" }),
    );
    expect(state.currentMode).toBe("plan");
    expect(state.planContent).toBe("");
    expect(state.pendingPermission).toBeNull();
  });

  test("ModeChanged to code sets currentMode", () => {
    const state = reducer(
      { ...initialState, currentMode: "plan" },
      makeEvent("ModeChanged", { modeId: "code" }),
    );
    expect(state.currentMode).toBe("code");
    expect(state.pendingPermission).toBeNull();
  });

  test("AgentText in plan mode still goes to streamingContent (chat)", () => {
    let state = reducer(
      initialState,
      makeEvent("ModeChanged", { modeId: "plan" }),
    );
    state = reducer(state, makeEvent("AgentText", { text: "Researching..." }, 2));

    // Text goes to chat, not plan pane
    expect(state.streamingContent).toHaveLength(1);
    expect(state.streamingContent[0]).toEqual({ type: "text", text: "Researching..." });
    expect(state.planContent).toBe("");
  });

  test("ToolCallStarted with switch_mode in plan mode is ignored (not added to streamingContent)", () => {
    let state = reducer(
      initialState,
      makeEvent("ModeChanged", { modeId: "plan" }),
    );
    state = reducer(
      state,
      makeEvent("ToolCallStarted", {
        toolCallId: "tc-exit",
        toolName: "Ready to code?",
        kind: "switch_mode",
        input: {},
      }, 2),
    );

    // ExitPlanMode tool call should NOT appear in streamingContent
    expect(state.streamingContent).toEqual([]);
  });

  test("PermissionRequested sets pendingPermission and planContent", () => {
    let state = reducer(
      initialState,
      makeEvent("ModeChanged", { modeId: "plan" }),
    );

    const permEvent: WsEvent = {
      type: "PermissionRequested",
      options: [
        { optionId: "acceptEdits", name: "Yes, and auto-accept edits", kind: "allow_always" },
        { optionId: "default", name: "Yes, and manually approve edits", kind: "allow_once" },
        { optionId: "plan", name: "No, keep planning", kind: "reject_once" },
      ],
      toolName: "Ready to code?",
      planContent: "# My Plan\n\nStep 1: Do stuff",
      seq: 2,
      timestamp: Date.now(),
      sessionId: "s1",
    };
    state = reducer(state, permEvent);

    expect(state.pendingPermission).not.toBeNull();
    expect(state.pendingPermission!.options).toHaveLength(3);
    expect(state.pendingPermission!.options[0].name).toBe("Yes, and auto-accept edits");
    expect(state.pendingPermission!.toolName).toBe("Ready to code?");
    // Plan content comes from the event
    expect(state.planContent).toBe("# My Plan\n\nStep 1: Do stuff");
  });

  test("PermissionRequested without planContent preserves existing planContent", () => {
    let state = { ...initialState, planContent: "existing plan" };

    const permEvent: WsEvent = {
      type: "PermissionRequested",
      options: [
        { optionId: "allow", name: "Allow", kind: "allow_once" },
      ],
      seq: 1,
      timestamp: Date.now(),
      sessionId: "s1",
    };
    state = reducer(state, permEvent);

    expect(state.planContent).toBe("existing plan");
  });

  test("PromptSubmitted clears pendingPermission", () => {
    const perm = {
      options: [{ optionId: "a", name: "Allow", kind: "allow_once" as const }],
      toolName: "test",
    };
    let state = reducer(
      { ...initialState, currentMode: "plan", pendingPermission: perm, planContent: "plan" },
      makeEvent("PromptSubmitted", { text: "feedback" }),
    );
    expect(state.pendingPermission).toBeNull();
  });

  test("AgentThought chunks accumulate as thought blocks in streamingContent", () => {
    let state = reducer(initialState, makeEvent("AgentThought", { text: "Hmm, " }));
    state = reducer(state, makeEvent("AgentThought", { text: "I think..." }, 2));
    expect(state.streamingContent).toEqual([
      { type: "thought", text: "Hmm, I think..." },
    ]);
  });

  test("AgentThought followed by AgentText creates separate blocks", () => {
    let state = reducer(initialState, makeEvent("AgentThought", { text: "thinking" }));
    state = reducer(state, makeEvent("AgentText", { text: "Here is the answer" }, 2));
    expect(state.streamingContent).toHaveLength(2);
    expect(state.streamingContent[0]).toEqual({ type: "thought", text: "thinking" });
    expect(state.streamingContent[1]).toEqual({ type: "text", text: "Here is the answer" });
  });

  test("UsageUpdated sets usage state", () => {
    const state = reducer(initialState, makeEvent("UsageUpdated", {
      size: 200000, used: 50000, costAmount: 0.05, costCurrency: "USD",
    }));
    expect(state.usage).toEqual({
      size: 200000, used: 50000, costAmount: 0.05, costCurrency: "USD",
    });
  });

  test("SessionInfoUpdated updates matching session title", () => {
    const stateWithSessions = {
      ...initialState,
      sessions: [{ sessionId: "s1", name: "Session 1", title: null, firstPrompt: "hi" }],
    };
    const state = reducer(
      stateWithSessions,
      makeEvent("SessionInfoUpdated", { title: "Refactoring Plan", updatedAt: "2026-02-19T12:00:00Z" }),
    );
    expect(state.sessions[0].title).toBe("Refactoring Plan");
  });

  test("interleaved text and tool calls preserve order", () => {
    let state = reducer(
      initialState,
      makeEvent("PromptSubmitted", { text: "do stuff" }),
    );
    state = reducer(state, makeEvent("AgentText", { text: "Let me read that." }, 2));
    state = reducer(
      state,
      makeEvent("ToolCallStarted", {
        toolCallId: "tc1",
        toolName: "Read",
        kind: "read",
        input: { path: "/a" },
      }, 3),
    );
    state = reducer(
      state,
      makeEvent("ToolCallCompleted", {
        toolCallId: "tc1",
        status: "completed",
        output: "content-a",
      }, 4),
    );
    state = reducer(state, makeEvent("AgentText", { text: "Now editing." }, 5));
    state = reducer(
      state,
      makeEvent("ToolCallStarted", {
        toolCallId: "tc2",
        toolName: "Edit",
        kind: "edit",
        input: { path: "/b" },
      }, 6),
    );
    state = reducer(
      state,
      makeEvent("ToolCallCompleted", {
        toolCallId: "tc2",
        status: "completed",
        output: "done",
      }, 7),
    );
    state = reducer(state, makeEvent("AgentText", { text: "All done!" }, 8));
    state = reducer(
      state,
      makeEvent("TurnCompleted", { stopReason: "end_turn" }, 9),
    );

    const msg = state.messages[1];
    expect(msg.content).toHaveLength(5);
    expect(msg.content[0]).toEqual({ type: "text", text: "Let me read that." });
    expect(msg.content[1].type).toBe("tool_call");
    if (msg.content[1].type === "tool_call") {
      expect(msg.content[1].toolCall.toolName).toBe("Read");
      expect(msg.content[1].toolCall.output).toBe("content-a");
    }
    expect(msg.content[2]).toEqual({ type: "text", text: "Now editing." });
    expect(msg.content[3].type).toBe("tool_call");
    if (msg.content[3].type === "tool_call") {
      expect(msg.content[3].toolCall.toolName).toBe("Edit");
      expect(msg.content[3].toolCall.output).toBe("done");
    }
    expect(msg.content[4]).toEqual({ type: "text", text: "All done!" });
  });
});
