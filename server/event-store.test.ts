import { describe, test, expect } from "bun:test";
import { EventStore } from "./event-store.ts";

describe("EventStore", () => {
  test("append assigns monotonic seq", () => {
    const store = new EventStore();
    const e1 = store.append("s1", { type: "AgentText", text: "hello" });
    const e2 = store.append("s1", { type: "AgentText", text: "world" });

    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(e2.seq).toBeGreaterThan(e1.seq);
  });

  test("append assigns timestamp", () => {
    const store = new EventStore();
    const before = Date.now();
    const e = store.append("s1", { type: "AgentText", text: "test" });
    const after = Date.now();

    expect(e.timestamp).toBeGreaterThanOrEqual(before);
    expect(e.timestamp).toBeLessThanOrEqual(after);
  });

  test("append assigns sessionId", () => {
    const store = new EventStore();
    const e = store.append("s1", { type: "AgentText", text: "test" });
    expect(e.sessionId).toBe("s1");
  });

  test("getAll returns full log in order", () => {
    const store = new EventStore();
    store.append("s1", { type: "SessionCreated" });
    store.append("s1", { type: "PromptSubmitted", text: "hi" });
    store.append("s1", { type: "AgentText", text: "hello" });

    const all = store.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].type).toBe("SessionCreated");
    expect(all[1].type).toBe("PromptSubmitted");
    expect(all[2].type).toBe("AgentText");
  });

  test("getAll returns a copy", () => {
    const store = new EventStore();
    store.append("s1", { type: "AgentText", text: "a" });
    const all = store.getAll();
    all.push({} as any);
    expect(store.getAll()).toHaveLength(1);
  });

  test("getFrom returns events from seq", () => {
    const store = new EventStore();
    store.append("s1", { type: "AgentText", text: "a" });
    store.append("s1", { type: "AgentText", text: "b" });
    store.append("s1", { type: "AgentText", text: "c" });

    const from2 = store.getFrom(2);
    expect(from2).toHaveLength(2);
    expect(from2[0].seq).toBe(2);
    expect(from2[1].seq).toBe(3);
  });

  test("subscribe receives new events", () => {
    const store = new EventStore();
    const received: any[] = [];

    store.subscribe((e) => received.push(e));

    store.append("s1", { type: "AgentText", text: "hello" });
    store.append("s1", { type: "AgentText", text: "world" });

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe("AgentText");
    expect(received[1].type).toBe("AgentText");
  });

  test("unsubscribe stops notifications", () => {
    const store = new EventStore();
    const received: any[] = [];

    const unsub = store.subscribe((e) => received.push(e));
    store.append("s1", { type: "AgentText", text: "before" });

    unsub();
    store.append("s1", { type: "AgentText", text: "after" });

    expect(received).toHaveLength(1);
  });

  test("getBySessionId filters by session", () => {
    const store = new EventStore();
    store.append("s1", { type: "AgentText", text: "a" });
    store.append("s2", { type: "AgentText", text: "b" });
    store.append("s1", { type: "AgentText", text: "c" });

    const s1Events = store.getBySessionId("s1");
    expect(s1Events).toHaveLength(2);
    expect(s1Events[0].sessionId).toBe("s1");
    expect(s1Events[1].sessionId).toBe("s1");

    const s2Events = store.getBySessionId("s2");
    expect(s2Events).toHaveLength(1);
    expect(s2Events[0].sessionId).toBe("s2");
  });
});
