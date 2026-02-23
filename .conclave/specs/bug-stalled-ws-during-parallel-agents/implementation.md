# Bug: WebSocket updates stall during parallel agent execution — Implementation

Break up the microtask chain in the WebSocket relay path so uWebSockets gets event-loop ticks to flush outbound data.

## Fix

**Files:**
- `server/index.ts` — modify `sendWs` and/or the store subscription in `subscribeWsToSession` to yield to the event loop

**Steps:**

1. In `subscribeWsToSession`, change the store listener to batch events and flush asynchronously. Instead of calling `sendWs` synchronously for each event, collect events and schedule a flush with `setTimeout(fn, 0)` to yield to the uWebSockets IO loop between batches:

   ```
   // Current (synchronous relay — starves event loop):
   store.subscribe((event) => {
     if (event.sessionId === sessionId) sendWs(ws, event);
   });

   // Fixed (yield between flushes):
   let pending: DomainEvent[] = [];
   let flushScheduled = false;
   store.subscribe((event) => {
     if (event.sessionId === sessionId) {
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
   ```

   `setTimeout(fn, 0)` schedules a macrotask, which forces the event loop through its IO phase (where uWebSockets flushes outbound buffers) before processing the batch. This adds at most ~1ms latency per batch but guarantees the TCP writes reach the wire.

2. Apply the same pattern to the global event broadcast subscriptions (SpecListUpdated, GitStatusUpdated, ServiceStatusUpdated) for consistency, though these are lower-frequency and less likely to trigger the issue.

3. Keep the `cork()` call inside `sendWs` — it's still valuable for batching multiple writes within a single flush into one syscall.

## New Tests

**Files:**
- `server/ws-relay.test.ts` — new integration test file

**Tests:**
- Store-driven delivery without client message → append 10 events to EventStore from outside any WS handler, assert the WS client receives all 10 within 500ms without sending anything
- Burst delivery completeness → append 100 events synchronously to EventStore, assert the WS client receives all 100 (in order) within 2s
- Latency bound on first event → append 1 event, assert the WS client receives it within 50ms (verifying the setTimeout(0) yield doesn't add excessive delay)
