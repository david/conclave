import { describe, test, expect } from "bun:test";
import { EventStore } from "./event-store.ts";
import { Projection } from "./projection.ts";

describe("Projection", () => {
  test("replays existing events on construction", () => {
    const store = new EventStore();
    store.append("s1", { type: "AgentText", text: "hello" });
    store.append("s1", { type: "AgentText", text: "world" });

    const projection = new Projection(store, 0, (count, event) => {
      return event.type === "AgentText" ? count + 1 : count;
    });

    expect(projection.getState()).toBe(2);
  });

  test("updates state on new events", () => {
    const store = new EventStore();
    const projection = new Projection(store, 0, (count, event) => {
      return event.type === "AgentText" ? count + 1 : count;
    });

    expect(projection.getState()).toBe(0);

    store.append("s1", { type: "AgentText", text: "hello" });
    expect(projection.getState()).toBe(1);

    store.append("s1", { type: "AgentText", text: "world" });
    expect(projection.getState()).toBe(2);
  });

  test("ignores events not handled by reducer", () => {
    const store = new EventStore();
    const projection = new Projection(store, 0, (count, event) => {
      return event.type === "SessionCreated" ? count + 1 : count;
    });

    store.append("s1", { type: "AgentText", text: "hello" });
    expect(projection.getState()).toBe(0);

    store.append("s1", { type: "SessionCreated" });
    expect(projection.getState()).toBe(1);
  });
});
