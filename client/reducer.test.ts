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
    expect(state.messages[0]).toEqual({ role: "user", text: "hello" });
    expect(state.isProcessing).toBe(true);
    expect(state.error).toBeNull();
  });

  test("AgentText chunks accumulate into currentAgentText", () => {
    let state = reducer(initialState, makeEvent("AgentText", { text: "hel" }));
    state = reducer(state, makeEvent("AgentText", { text: "lo " }, 2));
    state = reducer(state, makeEvent("AgentText", { text: "world" }, 3));

    expect(state.currentAgentText).toBe("hello world");
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
      text: "hello",
      toolCalls: undefined,
    });
    expect(state.currentAgentText).toBe("");
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

    expect(state.activeToolCalls.size).toBe(1);
    expect(state.activeToolCalls.get("tc1")?.status).toBe("pending");

    state = reducer(
      state,
      makeEvent("ToolCallUpdated", {
        toolCallId: "tc1",
        status: "in_progress",
      }, 2),
    );
    expect(state.activeToolCalls.get("tc1")?.status).toBe("in_progress");

    state = reducer(
      state,
      makeEvent("ToolCallCompleted", {
        toolCallId: "tc1",
        status: "completed",
        output: "file contents",
      }, 3),
    );
    expect(state.activeToolCalls.get("tc1")?.status).toBe("completed");
    expect(state.activeToolCalls.get("tc1")?.output).toBe("file contents");
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
    expect(assistantMsg.text).toBe("reading...");
    expect(assistantMsg.toolCalls).toHaveLength(1);
    expect(assistantMsg.toolCalls![0].toolName).toBe("Read");
    expect(state.activeToolCalls.size).toBe(0);
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
    expect(state.messages[0]).toEqual({ role: "user", text: "what is 2+2?" });
    expect(state.messages[1]).toEqual({
      role: "assistant",
      text: "The answer is 4.",
      toolCalls: undefined,
    });
    expect(state.messages[2]).toEqual({ role: "user", text: "thanks" });
    expect(state.messages[3]).toEqual({
      role: "assistant",
      text: "You're welcome!",
      toolCalls: undefined,
    });
    expect(state.isProcessing).toBe(false);
    expect(state.currentAgentText).toBe("");
  });
});
