import { describe, test, expect } from "bun:test";
import { EventStore } from "../event-store.ts";
import { createSessionRegistry } from "./session-registry.ts";

describe("SessionRegistry projection", () => {
  test("tracks created sessions", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionCreated" });

    const { sessions, sessionCounter } = registry.getState();
    expect(sessions.size).toBe(1);
    expect(sessions.get("s1")!.loaded).toBe(true);
    expect(sessionCounter).toBe(1);
  });

  test("tracks discovered sessions as not loaded", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionDiscovered", name: "Old Session", title: "Title", createdAt: 5000 });

    const session = registry.getState().sessions.get("s1")!;
    expect(session.loaded).toBe(false);
    expect(session.name).toBe("Old Session");
    expect(session.title).toBe("Title");
  });

  test("marks session loaded on SessionLoaded", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionDiscovered", name: "S1", title: null, createdAt: 1000 });
    expect(registry.getState().sessions.get("s1")!.loaded).toBe(false);

    store.append("s1", { type: "SessionLoaded" });
    expect(registry.getState().sessions.get("s1")!.loaded).toBe(true);
  });

  test("tracks firstPrompt on PromptSubmitted", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionCreated" });
    store.append("s1", { type: "PromptSubmitted", text: "Hello!" });

    expect(registry.getState().sessions.get("s1")!.firstPrompt).toBe("Hello!");
  });

  test("does not overwrite firstPrompt on subsequent prompts", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionCreated" });
    store.append("s1", { type: "PromptSubmitted", text: "First" });
    store.append("s1", { type: "PromptSubmitted", text: "Second" });

    expect(registry.getState().sessions.get("s1")!.firstPrompt).toBe("First");
  });

  test("updates title on SessionInfoUpdated", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionCreated" });
    store.append("s1", { type: "SessionInfoUpdated", title: "New Title" });

    expect(registry.getState().sessions.get("s1")!.title).toBe("New Title");
  });

  test("maintains session counter across creates and discovers", () => {
    const store = new EventStore();
    const registry = createSessionRegistry(store);

    store.append("s1", { type: "SessionDiscovered", name: "S1", title: null, createdAt: 1000 });
    store.append("s2", { type: "SessionDiscovered", name: "S2", title: null, createdAt: 2000 });
    store.append("s3", { type: "SessionCreated" });

    expect(registry.getState().sessionCounter).toBe(3);
    expect(registry.getState().sessions.get("s3")!.name).toBe("Session 3");
  });
});
