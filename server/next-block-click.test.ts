import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "path";
import { tmpdir } from "os";
import { EventStore } from "./event-store.ts";
import { createMetaContextRegistry } from "./projections/meta-context-registry.ts";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `conclave-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Tests for the next_block_click command handler logic.
 *
 * The actual handler lives in server/index.ts inside the WS message switch.
 * We test the event sequence it should produce by simulating the same
 * store.append() calls and verifying the resulting projection state.
 *
 * The handler's logic:
 * 1. Look up meta-context by name; create if missing
 * 2. Create a new session (SessionCreated)
 * 3. Add the new session to the meta-context (SessionAddedToMetaContext)
 * 4. Submit a prompt to the new session (PromptSubmitted)
 */
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

    // Simulate the handler logic:
    // 1. Meta-context doesn't exist → create it
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

    // 2. Create new session
    store.append(newSessionId, { type: "SessionCreated" });

    // 3. Add new session to meta-context
    store.append(newSessionId, {
      type: "SessionAddedToMetaContext",
      metaContextId,
      commandText,
    });

    // 4. Submit prompt on new session
    store.append(newSessionId, {
      type: "PromptSubmitted",
      text: commandText,
    });

    // Verify meta-context state
    const finalState = metaContextRegistry.getState();
    expect(finalState.contexts.size).toBe(1);
    expect(finalState.nameIndex.get(metaContextName)).toBe(metaContextId);

    const ctx = finalState.contexts.get(metaContextId)!;
    expect(ctx.name).toBe(metaContextName);
    expect(ctx.sessionIds).toContain(newSessionId);

    // Verify event sequence in store
    const allEvents = store.getAll();
    expect(allEvents[0].type).toBe("MetaContextEnsured");
    expect(allEvents[1].type).toBe("SessionCreated");
    expect(allEvents[2].type).toBe("SessionAddedToMetaContext");
    expect(allEvents[3].type).toBe("PromptSubmitted");

    // MetaContextEnsured should be on the origin session
    expect("sessionId" in allEvents[0] && allEvents[0].sessionId).toBe(currentSessionId);
    // SessionCreated, SessionAddedToMetaContext, and PromptSubmitted should be on new session
    expect("sessionId" in allEvents[1] && allEvents[1].sessionId).toBe(newSessionId);
    expect("sessionId" in allEvents[2] && allEvents[2].sessionId).toBe(newSessionId);
    expect("sessionId" in allEvents[3] && allEvents[3].sessionId).toBe(newSessionId);
  });

  test("reuses existing meta-context when it already exists", () => {
    const store = new EventStore();
    const metaContextRegistry = createMetaContextRegistry(store, tmpDir);

    const metaContextName = "Feature: Login";
    const metaContextId = "mc-existing";

    // Pre-create the meta-context from a previous session
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

    // Verify it exists
    const mcState = metaContextRegistry.getState();
    expect(mcState.nameIndex.get(metaContextName)).toBe(metaContextId);

    // Now simulate handler for a second next_block_click with same metaContext name
    const newSessionId = "session-new-2";

    // Handler should find existing meta-context, skip MetaContextEnsured creation
    const existingId = mcState.nameIndex.get(metaContextName);
    expect(existingId).toBe(metaContextId);

    // 1. Create new session
    store.append(newSessionId, { type: "SessionCreated" });

    // 2. Add new session to the EXISTING meta-context
    store.append(newSessionId, {
      type: "SessionAddedToMetaContext",
      metaContextId: existingId!,
      commandText: "Add validation to login form",
    });

    // 3. Submit prompt
    store.append(newSessionId, {
      type: "PromptSubmitted",
      text: "Add validation to login form",
    });

    // Verify meta-context still has same ID, now with two sessions
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

    // The MetaContextEnsured event must carry the CURRENT session ID (where button was clicked)
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
