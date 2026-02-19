import { describe, test, expect } from "bun:test";
import { EventStore } from "../event-store.ts";
import { createLatestSessionProjection } from "./latest-session.ts";

describe("LatestSession projection", () => {
  test("starts with null", () => {
    const store = new EventStore();
    const projection = createLatestSessionProjection(store);
    expect(projection.getState().latestSessionId).toBeNull();
  });

  test("updates on SessionCreated", () => {
    const store = new EventStore();
    const projection = createLatestSessionProjection(store);

    store.append("s1", { type: "SessionCreated" });
    expect(projection.getState().latestSessionId).toBe("s1");
  });

  test("updates on SessionDiscovered", () => {
    const store = new EventStore();
    const projection = createLatestSessionProjection(store);

    store.append("s1", { type: "SessionDiscovered", name: "S1", title: null, createdAt: 1000 });
    expect(projection.getState().latestSessionId).toBe("s1");
  });

  test("tracks the most recently emitted session", () => {
    const store = new EventStore();
    const projection = createLatestSessionProjection(store);

    store.append("s1", { type: "SessionDiscovered", name: "S1", title: null, createdAt: 1000 });
    store.append("s2", { type: "SessionDiscovered", name: "S2", title: null, createdAt: 2000 });
    store.append("s3", { type: "SessionCreated" });

    expect(projection.getState().latestSessionId).toBe("s3");
  });

  test("ignores unrelated events", () => {
    const store = new EventStore();
    const projection = createLatestSessionProjection(store);

    store.append("s1", { type: "SessionCreated" });
    store.append("s1", { type: "AgentText", text: "hello" });

    expect(projection.getState().latestSessionId).toBe("s1");
  });
});
