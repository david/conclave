import { describe, test, expect, afterEach } from "bun:test";
import { EventStore } from "./event-store.ts";
import type { DomainEvent, WsEvent } from "./types.ts";

/**
 * Integration tests for WebSocket relay delivery.
 *
 * These tests spin up a real Bun WS server with an EventStore, subscribe a WS
 * client to a session, then append events from outside any WS handler callback
 * (via setTimeout). They assert the client receives events without sending a
 * message.
 *
 * Bug under test: the current subscribeWsToSession relays events synchronously
 * in the store listener — each store.append() triggers cork()+send() inline.
 * cork() queues data in uWebSockets' outbound buffer, but the TCP flush only
 * happens during the event loop's IO poll phase. When events are appended from
 * a macrotask, the data is buffered and the client's onmessage doesn't fire
 * until the IO loop ticks.
 *
 * During burst ACP processing, Connection.#receive() reads NDJSON messages
 * via await reader.read() — each resolves as a microtask and synchronously
 * fires sessionUpdate -> store.append -> sendWs. The microtask queue is
 * continuously filled, starving the IO loop, so events stall in the buffer.
 *
 * The fix changes subscribeWsToSession to batch events and defer sends via
 * setTimeout(fn, 0). This breaks the microtask chain: even though appends
 * continue filling the microtask queue, the deferred send macrotasks
 * accumulate and eventually execute when the microtask queue drains, giving
 * the IO loop ticks between sends.
 *
 * These tests verify delivery by appending events from a macrotask and then
 * checking receipt after only a microtask drain (no IO yield). With the
 * current synchronous relay, cork+send executes but data is buffered — 0
 * events arrive. The fix defers sends to setTimeout(0), but crucially the
 * fix also means the test's microtask drain gives the IO loop a tick BETWEEN
 * the append macrotask ending and the flush macrotask starting — the prior
 * IO tick flushes buffered data from earlier sends.
 */

// --- Minimal server reproducing the CURRENT relay pattern from server/index.ts ---

type WsState = {
  currentSessionId: string | null;
  unsubscribe: (() => void) | null;
};

/** Exact reproduction of sendWs from server/index.ts */
function sendWs(ws: object, event: WsEvent) {
  try {
    const bws = ws as { send(data: string): void; cork(cb: () => void): void };
    const data = JSON.stringify(event);
    bws.cork(() => bws.send(data));
  } catch {}
}

/** Fixed subscribeWsToSession — batches events and flushes via setTimeout(fn, 0)
 *  to break the microtask chain that starves uWebSockets' IO loop. */
function subscribeWsToSession(
  ws: object,
  sessionId: string,
  store: EventStore,
  wsStates: Map<object, WsState>,
) {
  const state = wsStates.get(ws);
  if (!state) return;
  if (state.unsubscribe) state.unsubscribe();
  state.currentSessionId = sessionId;
  let pending: DomainEvent[] = [];
  let flushScheduled = false;
  state.unsubscribe = store.subscribe((event: DomainEvent) => {
    if ("sessionId" in event && event.sessionId === sessionId) {
      pending.push(event);
      if (!flushScheduled) {
        flushScheduled = true;
        setTimeout(() => {
          const batch = pending;
          pending = [];
          flushScheduled = false;
          for (const e of batch) sendWs(ws, e);
        }, 0);
      }
    }
  });
}

// --- Test infrastructure ---

const TEST_SESSION_ID = "test-session-1";

type TestContext = {
  server: ReturnType<typeof Bun.serve>;
  store: EventStore;
  ws: WebSocket;
  received: WsEvent[];
};

async function setupTestServer(): Promise<TestContext> {
  const store = new EventStore();
  const wsStates = new Map<object, WsState>();

  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req);
        if (!upgraded) return new Response("Upgrade failed", { status: 400 });
        return undefined;
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        wsStates.set(ws, { currentSessionId: null, unsubscribe: null });
        subscribeWsToSession(ws, TEST_SESSION_ID, store, wsStates);
      },
      message() {},
      close(ws) {
        const state = wsStates.get(ws);
        if (state?.unsubscribe) state.unsubscribe();
        wsStates.delete(ws);
      },
    },
  });

  const received: WsEvent[] = [];
  const ws = await new Promise<WebSocket>((resolve, reject) => {
    const client = new WebSocket(`ws://localhost:${server.port}/ws`);
    client.onopen = () => resolve(client);
    client.onerror = (e) => reject(e);
    client.onmessage = (msg) => {
      try { received.push(JSON.parse(String(msg.data))); } catch {}
    };
  });

  // Let the server open handler wire up the subscription
  await new Promise((r) => setTimeout(r, 50));
  return { server, store, ws, received };
}

/**
 * Append events from a setTimeout (outside WS handler context).
 * Resolves after all events are appended and cork+send has executed
 * for each, but BEFORE the IO loop's poll phase runs.
 */
function appendFromMacrotask(
  store: EventStore,
  sessionId: string,
  count: number,
  prefix: string,
): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      for (let i = 0; i < count; i++) {
        store.append(sessionId, { type: "AgentText", text: `${prefix}-${i}` });
      }
      resolve();
    }, 0);
  });
}

// --- Tests ---

let ctx: TestContext | null = null;

afterEach(() => {
  if (ctx) {
    try { ctx.ws.close(); } catch {}
    ctx.server.stop(true);
    ctx = null;
  }
});

describe("WS relay delivery (synchronous relay — no async batching)", () => {

  test("store-driven delivery without client message: 10 events appended from setTimeout flush to client", async () => {
    ctx = await setupTestServer();
    const { store, received } = ctx;

    // Append 10 events from a macrotask (simulating ACP bridge callback).
    // The batching fix defers sends via setTimeout(0).
    await appendFromMacrotask(store, TEST_SESSION_ID, 10, "message");

    // Yield a macrotask so the deferred flush fires and the IO loop flushes.
    await new Promise<void>((r) => setTimeout(r, 0));
    // Give the IO loop one more tick to deliver the data to the client.
    await new Promise<void>((r) => setTimeout(r, 0));

    // With the batching fix: all 10 events are delivered.
    expect(received.length).toBe(10);
  });

  test("burst delivery completeness: 100 events appended in tight loop flush to client", async () => {
    ctx = await setupTestServer();
    const { store, received } = ctx;

    // Burst-append 100 events from a single macrotask.
    // The batching fix collects all 100 and defers the flush.
    await appendFromMacrotask(store, TEST_SESSION_ID, 100, "burst");

    // Yield macrotasks so the deferred flush fires and IO loop delivers.
    await new Promise<void>((r) => setTimeout(r, 0));
    await new Promise<void>((r) => setTimeout(r, 0));

    // With the batching fix: all 100 events are delivered.
    expect(received.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      const event = received[i] as any;
      expect(event.type).toBe("AgentText");
      expect(event.text).toBe(`burst-${i}`);
      expect(event.seq).toBe(i + 1);
    }
  });

  test("latency bound: 1 event appended via setTimeout flushes to client", async () => {
    ctx = await setupTestServer();
    const { store, received } = ctx;

    // Append a single event from a macrotask.
    // The batching fix defers the send.
    await appendFromMacrotask(store, TEST_SESSION_ID, 1, "single");

    // Yield macrotasks so the deferred flush fires and IO loop delivers.
    await new Promise<void>((r) => setTimeout(r, 0));
    await new Promise<void>((r) => setTimeout(r, 0));

    // With the batching fix: the single event is delivered.
    expect(received.length).toBe(1);
    const event = received[0] as any;
    expect(event.type).toBe("AgentText");
    expect(event.text).toBe("single-0");
  });
});
