import { mock } from "bun:test";
import { EventStore } from "../event-store.ts";
import { createSessionRegistry } from "../projections/session-registry.ts";
import { createMetaContextRegistry } from "../projections/meta-context-registry.ts";
import { createDispatch } from "../dispatch.ts";

/** Minimal mock AcpBridge for handler tests. */
export function mockBridge() {
  return {
    createSession: mock(() => Promise.resolve("new-session-id")),
    loadSession: mock(() => Promise.resolve()),
    submitPrompt: mock(() => Promise.resolve()),
    cancel: mock(() => Promise.resolve()),
  };
}

export function setup(tmpDir = "/tmp/dispatch-test-" + Date.now()) {
  const store = new EventStore();
  const registry = createSessionRegistry(store);
  const metaContextRegistry = createMetaContextRegistry(store, tmpDir);
  const bridge = mockBridge();
  const dispatch = createDispatch(store, registry, metaContextRegistry, bridge as any);
  return { store, registry, metaContextRegistry, bridge, dispatch };
}

/** Pre-populate a created (loaded) session. */
export function withCreatedSession(store: EventStore, sessionId: string) {
  store.append(sessionId, { type: "SessionCreated" });
}

/** Pre-populate a discovered (unloaded) session. */
export function withDiscoveredSession(store: EventStore, sessionId: string) {
  store.append(sessionId, { type: "SessionDiscovered", name: "Session", title: null, createdAt: Date.now() });
}
