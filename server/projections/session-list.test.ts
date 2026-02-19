import { describe, test, expect } from "bun:test";
import { EventStore } from "../event-store.ts";
import { createSessionRegistry } from "./session-registry.ts";
import { createSessionListProjection, buildSessionList } from "./session-list.ts";

describe("SessionList projection", () => {
  test("buildSessionList returns sessions sorted by recency", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionDiscovered", name: "S1", title: null, createdAt: 1000 });
    store.append("s2", { type: "SessionDiscovered", name: "S2", title: null, createdAt: 3000 });
    store.append("s3", { type: "SessionCreated" });

    const list = buildSessionList(registry);
    expect(list.type).toBe("SessionList");
    expect(list.seq).toBe(-1);
    expect(list.sessions).toHaveLength(3);
    // s3 has highest createdAt (timestamp from store.append), s2 next, s1 last
    expect(list.sessions[0].sessionId).toBe("s3");
    expect(list.sessions[1].sessionId).toBe("s2");
    expect(list.sessions[2].sessionId).toBe("s1");
  });

  test("buildSessionList includes title and firstPrompt", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionCreated" });
    store.append("s1", { type: "PromptSubmitted", text: "Hello!" });
    store.append("s1", { type: "SessionInfoUpdated", title: "My Title" });

    const list = buildSessionList(registry);
    expect(list.sessions[0].title).toBe("My Title");
    expect(list.sessions[0].firstPrompt).toBe("Hello!");
  });

  test("createSessionListProjection fires callback on session-affecting events", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);
    const calls: number[] = [];

    createSessionListProjection(store, registry, () => {
      calls.push(calls.length);
    });

    store.append("s1", { type: "SessionCreated" });
    expect(calls).toHaveLength(1);

    store.append("s1", { type: "PromptSubmitted", text: "Hi" });
    expect(calls).toHaveLength(2);

    store.append("s1", { type: "SessionInfoUpdated", title: "Title" });
    expect(calls).toHaveLength(3);

    // Unrelated event should NOT trigger callback
    store.append("s1", { type: "AgentText", text: "hello" });
    expect(calls).toHaveLength(3);
  });
});
