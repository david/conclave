import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "path";
import { tmpdir } from "os";
import { setup, withCreatedSession } from "../test-helpers.ts";
import { EventStore } from "../../event-store.ts";
import { createMetaContextRegistry } from "../../projections/meta-context-registry.ts";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `conclave-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("NextBlockClick handler", () => {
  test("emits NextBlockInitiated", async () => {
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

  test("full pipeline produces correct event sequence", async () => {
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

    expect(types).toContain("NextBlockInitiated");
    expect(types).toContain("MetaContextEnsured");
    const newSessionCreated = events.filter(e => e.type === "SessionCreated" && "sessionId" in e && e.sessionId === "new-s1");
    expect(newSessionCreated.length).toBe(1);
    expect(types).toContain("SessionAddedToMetaContext");
    expect(types).toContain("PromptSubmitted");
    expect(bridge.submitPrompt).toHaveBeenCalled();
  });
});

describe("next_block_click event sequence", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test("creates meta-context when it does not exist, then adds session", () => {
    const store = new EventStore();
    const metaContextRegistry = createMetaContextRegistry(store, tmpDir);

    const currentSessionId = "session-origin";
    const newSessionId = "session-new";
    const metaContextName = "Feature: Login";
    const metaContextId = "mc-uuid-1";
    const commandText = "Implement login form";

    const mcState = metaContextRegistry.getState();
    expect(mcState.nameIndex.has(metaContextName)).toBe(false);

    store.append(currentSessionId, {
      type: "MetaContextEnsured",
      metaContextId,
      metaContextName,
      originSessionId: currentSessionId,
      commandText,
      created: true,
    });

    store.append(newSessionId, { type: "SessionCreated" });

    store.append(newSessionId, {
      type: "SessionAddedToMetaContext",
      metaContextId,
      commandText,
    });

    store.append(newSessionId, {
      type: "PromptSubmitted",
      text: commandText,
    });

    const finalState = metaContextRegistry.getState();
    expect(finalState.contexts.size).toBe(1);
    expect(finalState.nameIndex.get(metaContextName)).toBe(metaContextId);

    const ctx = finalState.contexts.get(metaContextId)!;
    expect(ctx.name).toBe(metaContextName);
    expect(ctx.sessionIds).toContain(newSessionId);

    const allEvents = store.getAll();
    expect(allEvents[0].type).toBe("MetaContextEnsured");
    expect(allEvents[1].type).toBe("SessionCreated");
    expect(allEvents[2].type).toBe("SessionAddedToMetaContext");
    expect(allEvents[3].type).toBe("PromptSubmitted");

    expect("sessionId" in allEvents[0] && allEvents[0].sessionId).toBe(currentSessionId);
    expect("sessionId" in allEvents[1] && allEvents[1].sessionId).toBe(newSessionId);
    expect("sessionId" in allEvents[2] && allEvents[2].sessionId).toBe(newSessionId);
    expect("sessionId" in allEvents[3] && allEvents[3].sessionId).toBe(newSessionId);
  });

  test("reuses existing meta-context when it already exists", () => {
    const store = new EventStore();
    const metaContextRegistry = createMetaContextRegistry(store, tmpDir);

    const metaContextName = "Feature: Login";
    const metaContextId = "mc-existing";

    store.append("session-old", {
      type: "MetaContextEnsured",
      metaContextId,
      metaContextName,
      originSessionId: "session-old",
      commandText: "/plan login",
      created: true,
    });
    store.append("session-old", {
      type: "SessionAddedToMetaContext",
      metaContextId,
      commandText: "/plan login",
    });

    const mcState = metaContextRegistry.getState();
    expect(mcState.nameIndex.get(metaContextName)).toBe(metaContextId);

    const newSessionId = "session-new-2";

    const existingId = mcState.nameIndex.get(metaContextName);
    expect(existingId).toBe(metaContextId);

    store.append(newSessionId, { type: "SessionCreated" });

    store.append(newSessionId, {
      type: "SessionAddedToMetaContext",
      metaContextId: existingId!,
      commandText: "Add validation to login form",
    });

    store.append(newSessionId, {
      type: "PromptSubmitted",
      text: "Add validation to login form",
    });

    const finalState = metaContextRegistry.getState();
    expect(finalState.contexts.size).toBe(1);
    const ctx = finalState.contexts.get(metaContextId)!;
    expect(ctx.sessionIds).toEqual(["session-old", "session-new-2"]);
  });

  test("MetaContextEnsured event is appended with the current session's ID", () => {
    const store = new EventStore();
    const metaContextRegistry = createMetaContextRegistry(store, tmpDir);

    const currentSessionId = "session-current";
    const newSessionId = "session-spawned";

    store.append(currentSessionId, {
      type: "MetaContextEnsured",
      metaContextId: "mc-1",
      metaContextName: "My Context",
      originSessionId: currentSessionId,
      commandText: "/plan x",
      created: true,
    });

    store.append(newSessionId, { type: "SessionCreated" });

    store.append(newSessionId, {
      type: "SessionAddedToMetaContext",
      metaContextId: "mc-1",
      commandText: "/plan x",
    });

    const events = store.getAll();
    const mcEnsured = events.find((e) => e.type === "MetaContextEnsured")!;
    expect("sessionId" in mcEnsured && mcEnsured.sessionId).toBe(currentSessionId);

    const sessionAdded = events.find((e) => e.type === "SessionAddedToMetaContext")!;
    expect("sessionId" in sessionAdded && sessionAdded.sessionId).toBe(newSessionId);
  });
});
