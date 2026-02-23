# Bug: WebSocket updates stall during parallel agent execution

Frontend stops receiving real-time updates when the orchestrator spawns parallel sub-agents via the Task tool, then receives all buffered updates at once when the user sends a message.

## Symptom

1. User invokes the orchestrator skill, which spawns parallel agents (e.g., "Now running 2 agents in parallel for wave 0")
2. The frontend goes silent — no streaming text, tool calls, or plan updates appear
3. User sends any message (e.g., "any news?")
4. Immediately upon sending, all accumulated updates flood in at once — the agent has already progressed to a later wave

The key tell: updates arrive *instantly* on the next user message, proving data was buffered server-side but never flushed to the wire.

## Root Cause

The bug is a uWebSockets/Bun event-loop scheduling issue where `cork(() => send())` batches data but doesn't force a TCP flush when called from outside a WebSocket handler callback.

- **Where:** `server/index.ts:sendWs` (line ~88–101) and the interaction between `EventStore.subscribe` listeners, `AcpBridge.sessionUpdate`, and Bun's uWebSockets event loop.
- **What:** When ACP `sessionUpdate` notifications arrive in a burst (as happens during parallel agent execution), the processing path is:
  1. ACP subprocess writes multiple NDJSON lines to stdout
  2. Bun reads a chunk containing multiple messages
  3. `ndJsonStream` (ACP SDK) parses and enqueues them to a `ReadableStream`
  4. `Connection.#receive()` reads each message and fires `#processMessage` **without awaiting** — all handlers run as microtasks
  5. Each `sessionUpdate` handler synchronously calls `onEvent` → `store.append` → listeners → `sendWs` → `cork(() => send())`
  6. `cork()` batches the WebSocket write, but **the actual TCP flush only happens when control returns to uWebSockets' native event loop** (the epoll/kqueue IO phase)
  7. Because all notifications process as microtasks in the same macrotask, uWebSockets never gets an opportunity to flush between them — and may not flush at all until the next external IO event

- **Why:** `cork()` is necessary but not sufficient for writes originating outside uWebSockets handler callbacks (open/message/drain). The comment in `sendWs` acknowledges this problem and attempted to solve it with `cork()`, but `cork()` only ensures writes are batched into a single syscall when the flush *does* happen — it doesn't *trigger* the flush. During bursts of ACP notifications processed as microtasks, the uWebSockets IO loop is starved, and buffered writes accumulate until external socket activity (like an inbound WebSocket frame from the user) gives uWebSockets a chance to process outbound data.

  The problem is particularly acute during parallel agent execution because:
  - Multiple sub-agents produce interleaved `sessionUpdate` notifications at high throughput
  - The ACP subprocess buffers its stdout, so notifications arrive in large chunks rather than one-at-a-time
  - The ACP SDK's `Connection.#receive()` processes messages without yielding to the event loop between them

## Missing Test Coverage

- **Test 1:** EventStore-driven WS delivery without client activity — append events to the store from a timer (simulating ACP callback), verify the WS client receives them within a bounded time without sending any message. Would have failed because events would sit in the buffer indefinitely.

- **Test 2:** Burst delivery latency — append 50+ events to the store in a tight synchronous loop (simulating a burst of ACP notifications), verify the WS client receives all of them within a reasonable timeout. Would have revealed the starvation pattern.

These are integration tests requiring a real Bun WebSocket server + client, which is why the issue wasn't caught by the existing unit-test-level coverage.

## Fix Approach

The fix should ensure the event loop yields to uWebSockets between bursts of notifications. The most targeted approach is to insert a `setTimeout(0)` or `setImmediate` yield in the event relay path, giving uWebSockets a chance to flush. Alternatively, the `sendWs` function could use Bun's `ServerWebSocket.send()` directly (without the object cast) and check its return value for backpressure, or the store subscription could debounce/batch sends with a microtask-boundary flush. The preferred approach is a yield point that breaks up the microtask chain without adding latency — a `setTimeout(cb, 0)` after each `cork`/`send` pair, or batching events and flushing on `queueMicrotask` completion.
