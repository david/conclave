import { describe, test, expect, beforeEach, mock } from "bun:test";
import { EventStore } from "./event-store.ts";
import { createSessionRegistry } from "./projections/session-registry.ts";
import { createMetaContextRegistry } from "./projections/meta-context-registry.ts";
import { createDispatch } from "./dispatch.ts";
import type { ServerCommand } from "./types.ts";

// Minimal mock AcpBridge
function mockBridge() {
  return {
    createSession: mock(() => Promise.resolve("new-session-id")),
    loadSession: mock(() => Promise.resolve()),
    submitPrompt: mock(() => Promise.resolve()),
    cancel: mock(() => Promise.resolve()),
  };
}

function setup(tmpDir = "/tmp/dispatch-test-" + Date.now()) {
  const store = new EventStore();
  const registry = createSessionRegistry(store);
  const metaContextRegistry = createMetaContextRegistry(store, tmpDir);
  const bridge = mockBridge();
  const dispatch = createDispatch(store, registry, metaContextRegistry, bridge as any);
  return { store, registry, metaContextRegistry, bridge, dispatch };
}

// Helper: pre-populate a created (loaded) session
function withCreatedSession(store: EventStore, sessionId: string) {
  store.append(sessionId, { type: "SessionCreated" });
}

// Helper: pre-populate a discovered (unloaded) session
function withDiscoveredSession(store: EventStore, sessionId: string) {
  store.append(sessionId, { type: "SessionDiscovered", name: "Session", title: null, createdAt: Date.now() });
}

describe("dispatch", () => {
  // --- Pass-through command handlers ---

  test("RecordAgentText emits AgentText event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "RecordAgentText", text: "hello" });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("AgentText");
    if (events[0].type === "AgentText") {
      expect(events[0].text).toBe("hello");
    }
    expect("sessionId" in events[0] && events[0].sessionId).toBe("s1");
  });

  test("RecordAgentThought emits AgentThought event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "RecordAgentThought", text: "thinking..." });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("AgentThought");
  });

  test("RecordToolCallStarted emits ToolCallStarted event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordToolCallStarted",
      toolCallId: "tc-1",
      toolName: "Read",
      kind: "read",
      input: { path: "/foo" },
    });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ToolCallStarted");
  });

  test("RecordToolCallUpdated emits ToolCallUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordToolCallUpdated",
      toolCallId: "tc-1",
      status: "in_progress",
    });

    expect(store.getAll()[0].type).toBe("ToolCallUpdated");
  });

  test("RecordToolCallCompleted emits ToolCallCompleted event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordToolCallCompleted",
      toolCallId: "tc-1",
      status: "completed",
      output: "done",
    });

    expect(store.getAll()[0].type).toBe("ToolCallCompleted");
  });

  test("RecordPlanUpdated emits PlanUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordPlanUpdated",
      entries: [{ content: "task", status: "pending", priority: "high" }],
    });

    expect(store.getAll()[0].type).toBe("PlanUpdated");
  });

  test("RecordUsageUpdated emits UsageUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordUsageUpdated",
      size: 200000,
      used: 50000,
    });

    expect(store.getAll()[0].type).toBe("UsageUpdated");
  });

  test("RecordSessionInfoUpdated emits SessionInfoUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordSessionInfoUpdated",
      title: "My Chat",
    });

    expect(store.getAll()[0].type).toBe("SessionInfoUpdated");
  });

  test("CompleteTurn emits TurnCompleted event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "CompleteTurn", stopReason: "end_turn" });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("TurnCompleted");
  });

  test("RecordError emits ErrorOccurred event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", { type: "RecordError", message: "something broke" });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ErrorOccurred");
    if (events[0].type === "ErrorOccurred") {
      expect(events[0].message).toBe("something broke");
    }
  });

  // --- DiscoverSession ---

  test("DiscoverSession emits SessionDiscovered event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "DiscoverSession",
      name: "Session 1",
      title: "My Title",
      createdAt: 1000,
    });

    const events = store.getAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("SessionDiscovered");
    if (events[0].type === "SessionDiscovered") {
      expect(events[0].name).toBe("Session 1");
      expect(events[0].title).toBe("My Title");
      expect(events[0].createdAt).toBe(1000);
    }
  });

  // --- CreateSession ---

  test("CreateSession calls bridge and emits SessionCreated", async () => {
    const { store, bridge, dispatch } = setup();
    await dispatch("_", { type: "CreateSession" });

    expect(bridge.createSession).toHaveBeenCalled();
    const events = store.getAll();
    // SessionCreated + processor chain (AutoSwitchAfterCreate → SessionSwitched)
    const sessionCreated = events.find(e => e.type === "SessionCreated");
    expect(sessionCreated).toBeDefined();
    if (sessionCreated && "sessionId" in sessionCreated) {
      expect(sessionCreated.sessionId).toBe("new-session-id");
    }
  });

  test("AutoSwitchAfterCreate processor issues SwitchSession on SessionCreated", async () => {
    const { store, dispatch } = setup();
    await dispatch("_", { type: "CreateSession" });

    const events = store.getAll();
    const switched = events.find(e => e.type === "SessionSwitched");
    expect(switched).toBeDefined();
    if (switched && "sessionId" in switched) {
      expect(switched.sessionId).toBe("new-session-id");
    }
  });

  // --- SwitchSession ---

  test("SwitchSession emits SessionSwitched with epoch", async () => {
    const { store, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "SwitchSession" });

    const events = store.getAll();
    const switched = events.find(e => e.type === "SessionSwitched");
    expect(switched).toBeDefined();
    if (switched && switched.type === "SessionSwitched") {
      expect(switched.epoch).toBeTruthy();
      expect(typeof switched.epoch).toBe("string");
    }
  });

  test("SwitchSession rejects unknown session", async () => {
    const { store, dispatch } = setup();
    await dispatch("nonexistent", { type: "SwitchSession" });

    const events = store.getAll();
    const error = events.find(e => e.type === "ErrorOccurred");
    expect(error).toBeDefined();
  });

  test("LoadIfUnloaded processor issues LoadSession for unloaded session", async () => {
    const { store, bridge, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "SwitchSession" });

    expect(bridge.loadSession).toHaveBeenCalledWith("s1");
    const events = store.getAll();
    const loaded = events.find(e => e.type === "SessionLoaded");
    expect(loaded).toBeDefined();
  });

  test("LoadIfUnloaded processor skips already-loaded sessions", async () => {
    const { store, bridge, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "SwitchSession" });

    expect(bridge.loadSession).not.toHaveBeenCalled();
    const events = store.getAll();
    expect(events.find(e => e.type === "SessionLoaded")).toBeUndefined();
  });

  // --- LoadSession ---

  test("LoadSession calls bridge and emits SessionLoaded", async () => {
    const { store, bridge, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "LoadSession" });

    expect(bridge.loadSession).toHaveBeenCalledWith("s1");
    const events = store.getAll();
    const loaded = events.find(e => e.type === "SessionLoaded");
    expect(loaded).toBeDefined();
  });

  test("LoadSession does not emit synthetic TurnCompleted", async () => {
    const { store, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "LoadSession" });

    const events = store.getAll();
    expect(events.find(e => e.type === "TurnCompleted")).toBeUndefined();
  });

  // --- SubmitPrompt ---

  test("SubmitPrompt emits PromptSubmitted and calls bridge", async () => {
    const { store, bridge, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "SubmitPrompt", text: "hello" });

    const events = store.getAll();
    const prompt = events.find(e => e.type === "PromptSubmitted");
    expect(prompt).toBeDefined();
    if (prompt && prompt.type === "PromptSubmitted") {
      expect(prompt.text).toBe("hello");
    }
    expect(bridge.submitPrompt).toHaveBeenCalledWith("s1", "hello", undefined, true);
  });

  test("SubmitPrompt rejects unloaded session", async () => {
    const { store, bridge, dispatch } = setup();
    withDiscoveredSession(store, "s1");

    await dispatch("s1", { type: "SubmitPrompt", text: "hello" });

    const events = store.getAll();
    expect(events.find(e => e.type === "PromptSubmitted")).toBeUndefined();
    const error = events.find(e => e.type === "ErrorOccurred");
    expect(error).toBeDefined();
    expect(bridge.submitPrompt).not.toHaveBeenCalled();
  });

  // --- CancelPrompt ---

  test("CancelPrompt emits CancellationRequested and calls bridge", async () => {
    const { store, bridge, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", { type: "CancelPrompt" });

    const events = store.getAll();
    const cancel = events.find(e => e.type === "CancellationRequested");
    expect(cancel).toBeDefined();
    expect(bridge.cancel).toHaveBeenCalledWith("s1");
  });

  // --- NextBlockClick pipeline ---

  test("NextBlockClick emits NextBlockInitiated", async () => {
    const { store, dispatch } = setup();
    withCreatedSession(store, "s1");

    await dispatch("s1", {
      type: "NextBlockClick",
      currentSessionId: "s1",
      label: "Continue",
      commandText: "/plan feat",
      metaContext: "Feature: Login",
    });

    const events = store.getAll();
    const initiated = events.find(e => e.type === "NextBlockInitiated");
    expect(initiated).toBeDefined();
  });

  test("Full next-block-click pipeline produces correct event sequence", async () => {
    const { store, bridge, dispatch } = setup();
    withCreatedSession(store, "origin-s1");
    bridge.createSession = mock(() => Promise.resolve("new-s1"));

    await dispatch("origin-s1", {
      type: "NextBlockClick",
      currentSessionId: "origin-s1",
      label: "Continue",
      commandText: "/plan feat",
      metaContext: "Feature: Login",
    });

    const events = store.getAll();
    const types = events.map(e => e.type);

    // The pipeline should produce these events in order:
    // SessionCreated (origin-s1), NextBlockInitiated, MetaContextEnsured,
    // SessionCreated (new-s1), SessionSwitched, SessionAddedToMetaContext,
    // PromptSubmitted
    expect(types).toContain("NextBlockInitiated");
    expect(types).toContain("MetaContextEnsured");
    // The new session should be created
    const newSessionCreated = events.filter(e => e.type === "SessionCreated" && "sessionId" in e && e.sessionId === "new-s1");
    expect(newSessionCreated.length).toBe(1);
    expect(types).toContain("SessionAddedToMetaContext");
    expect(types).toContain("PromptSubmitted");
    expect(bridge.submitPrompt).toHaveBeenCalled();
  });

  // --- Processor infrastructure ---

  test("dispatch does not invoke processors for non-matching events", async () => {
    const { store, dispatch } = setup();
    // RecordAgentText should not trigger any processors
    await dispatch("s1", { type: "RecordAgentText", text: "hello" });

    // Only the AgentText event should be in the store
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].type).toBe("AgentText");
  });
});
