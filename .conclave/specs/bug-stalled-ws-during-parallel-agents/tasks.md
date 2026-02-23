# Bug: Stalled WS During Parallel Agents — Tasks

Strict TDD: write integration tests first (red — they fail against the current buggy relay), then apply the fix (green).

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Red: integration tests for WS relay delivery",
    "ucs": [],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": ["server/ws-relay.test.ts"],
      "modify": []
    },
    "description": "Create integration tests that spin up a real Bun WS server with an EventStore and subscribe a client to a session. Tests append events from outside any WS handler callback (via setTimeout) and assert the client receives them without sending a message. These tests MUST fail red against the current code — events stall in uWebSockets' buffer and never arrive within the timeout. The red failure is 'expected N events within Xms, received 0' — not a missing-function or import error."
  },
  {
    "id": "T-1",
    "name": "Green: async-flush WS relay subscriptions",
    "ucs": [],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["server/index.ts"]
    },
    "description": "Modify subscribeWsToSession and global broadcast subscriptions in server/index.ts to batch events and flush asynchronously via setTimeout(fn, 0), breaking the microtask chain that starves uWebSockets' IO loop. After this change, the T-0 tests must pass green."
  }
]
```

## Wave 0

### T-0: Red — integration tests for WS relay delivery
- **Files**: create `server/ws-relay.test.ts`
- **Summary**: Create a new integration test file that spins up a minimal Bun WebSocket server wired to an EventStore (reusing the real `EventStore`, `sendWs`, and `subscribeWsToSession` from `server/index.ts` or reproducing the same pattern). Connect a WS client, subscribe it to a session, then append events to the store from outside any WS handler (via `setTimeout`). Assert the client receives them within a bounded timeout — without ever sending a client message.

  These tests target the actual bug: events appended from outside a WS callback sit in uWebSockets' buffer and never flush. Against the current code, they must **fail red** with a meaningful failure like "expected 10 events within 500ms, received 0".

- **Tests**:
  - **Store-driven delivery without client message**: Use `setTimeout` to append 10 events to the EventStore (simulating ACP callback arriving outside WS handler context). Assert the WS client receives all 10 within 500ms without sending anything. **Red because**: events sit in uWebSockets buffer, client receives 0.
  - **Burst delivery completeness**: Append 100 events synchronously to the EventStore in a tight loop. Assert the WS client receives all 100 in order within 2s. **Red because**: the burst processes entirely within microtasks, uWebSockets never gets an IO tick to flush.
  - **Latency bound on first event**: Append 1 event via `setTimeout`, assert the WS client receives it within 50ms. **Red because**: the single event also stalls in the buffer.

## Wave 1 (after wave 0)

### T-1: Green — async-flush WS relay subscriptions
- **Depends on**: T-0
- **Files**: modify `server/index.ts`
- **Summary**: In `subscribeWsToSession` (line ~114), change the store listener from synchronous relay to an async-batched pattern. Collect events into a `pending` array and schedule a flush with `setTimeout(fn, 0)` so the event loop yields to uWebSockets' IO phase between batches. Apply the same pattern to the three global broadcast subscriptions (SpecListUpdated, GitStatusUpdated, ServiceStatusUpdated). Keep the existing `cork()` call inside `sendWs` — it still batches multiple writes within a single flush into one syscall.

  Concrete changes:
  1. In `subscribeWsToSession`, replace the synchronous `store.subscribe` callback with a batching pattern: accumulate matching events in a `pending` array, schedule a single `setTimeout(() => { flush pending via sendWs }, 0)` on first event, reset after flush.
  2. Apply the same batching pattern to the three `store.subscribe` calls for global events (SpecListUpdated, GitStatusUpdated, ServiceStatusUpdated) that iterate `wsStates` and call `sendWs`.
  3. No changes to `sendWs` itself — `cork(() => send())` remains.
  4. Run T-0 tests — all must pass green.
