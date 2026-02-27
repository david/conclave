# One Command, One Event — Test Plan

This refactor introduces a `dispatch` function, `appendReplay`, processor infrastructure, renames/removes event types, and rewires both the WS handler and ACP bridge. Tests are overwhelmingly unit-level: each command handler, processor, and renamed slice is a pure function or thin wrapper testable in isolation. Integration tests cover the dispatch→processor chain interaction. No e2e tests are needed — observable WebSocket behavior is unchanged.

## Existing Coverage

| Test file | Level | What it covers | Status |
|-----------|-------|---------------|--------|
| `server/event-store.test.ts` | unit | `append`, `appendGlobal`, `getAll`, `getBySessionId`, `getFrom`, `subscribe`/`unsubscribe` | extend |
| `server/acp-translate.test.ts` | unit | `translateAcpUpdate` → event payloads for all ACP update types | extend |
| `server/acp-bridge.test.ts` | unit | `buildPromptBlocks` utility | sufficient |
| `server/next-block-click.test.ts` | integration | Next-block-click event sequence via direct `store.append` calls | extend |
| `server/slices/meta-context-created.test.ts` | unit | `metaContextCreatedSlice` reducer | extend |
| `server/slices/session-added-to-meta-context.test.ts` | unit | `sessionAddedToMetaContextSlice` reducer | sufficient |
| `server/slices/utils.test.ts` | unit | `nextNewSessionName` | sufficient |
| `server/projection.test.ts` | unit | `Projection` replay + live subscription | sufficient |
| `server/projections/session-registry.test.ts` | unit | SessionRegistry tracks creates, discovers, loads, prompts, titles | sufficient |
| `server/projections/latest-session.test.ts` | unit | LatestSession tracks most recent session | sufficient |
| `server/projections/meta-context-registry.test.ts` | integration | MetaContextRegistry with file persistence and event processing | extend |
| `server/projections/session-list.test.ts` | unit | `buildSessionList` sorting, `createSessionListProjection` callback | sufficient |
| `server/ws-relay.test.ts` | integration | WS batched delivery via `subscribeWsToSession` | sufficient |
| `client/reducer.test.ts` | unit | `applyEvent`/`fold` for all client event types including `Error` | extend |
| `client/slices/session-switched.test.ts` | unit | `sessionSwitchedSlice` reset behavior | sufficient |

Tests marked "extend" need new scenarios for renamed events (`MetaContextEnsured`, `ErrorOccurred`, `CancellationRequested`), new methods (`appendReplay`), and translated-to-commands output.

## New Types

### Command union type compiles with all variants

- **Level:** unit
- **Status:** new
- **File:** `server/types.test.ts`
- **Covers:** New Types step 1 — `Command` discriminated union
- **Scenario:**
  - **Arrange:** Import the server-side `Command` type.
  - **Act:** Assign literal objects for each command variant (`CreateSession`, `SwitchSession`, `LoadSession`, `DiscoverSession`, `SubmitPrompt`, `CancelPrompt`, `NextBlockClick`, `EnsureMetaContext`, `AddSessionToMetaContext`, `RecordAgentText`, `RecordToolCallStarted`, `RecordToolCallUpdated`, `RecordToolCallCompleted`, `RecordPlanUpdated`, `RecordUsageUpdated`, `RecordSessionInfoUpdated`, `CompleteTurn`, `RecordError`).
  - **Assert:** TypeScript compilation passes (no runtime assertion needed — this is a compile-time check). As a smoke test, verify `command.type` narrowing works for at least 3 variants.

### WsCommand type preserves existing wire commands

- **Level:** unit
- **Status:** new
- **File:** `server/types.test.ts`
- **Covers:** New Types step 2 — `WsCommand` rename
- **Scenario:**
  - **Arrange:** Import `WsCommand` type.
  - **Act:** Assign literal objects for `submit_prompt`, `cancel`, `create_session`, `switch_session`, `next_block_click`.
  - **Assert:** Compilation passes. `permission_response` is NOT assignable to `WsCommand`.

### ErrorOccurred event replaces Error event

- **Level:** unit
- **Status:** new
- **File:** `server/types.test.ts`
- **Covers:** New Types step 3 — `ErrorEvent` renamed to `ErrorOccurred`
- **Scenario:**
  - **Arrange:** Import `SessionEvent` union and `ErrorOccurred` type.
  - **Act:** Create an `ErrorOccurred` event with `type: "ErrorOccurred"` and `message` field.
  - **Assert:** The event satisfies `SessionEvent`. There is no `"Error"` type in the union (verify by checking that `{ type: "Error" }` is not assignable).

### PermissionRequested removed from SessionEvent

- **Level:** unit
- **Status:** new
- **File:** `server/types.test.ts`
- **Covers:** New Types steps 4, Dead code removal steps 1-3
- **Scenario:**
  - **Arrange:** Import `SessionEvent`.
  - **Act:** Attempt to assign `{ type: "PermissionRequested" }`.
  - **Assert:** Type error (compile-time check — verified by the test file compiling without including `PermissionRequested`).

### New event types compile correctly

- **Level:** unit
- **Status:** new
- **File:** `server/types.test.ts`
- **Covers:** New Types steps 5-8 — `MetaContextEnsured`, `NextBlockInitiated`, `CancellationRequested`, `SessionSwitched` with `epoch`
- **Scenario:**
  - **Arrange:** Import each new event type.
  - **Act:** Construct instances: `MetaContextEnsured` with `created: true/false`, `metaContextId`, `metaContextName`, `originSessionId`, `commandText`; `NextBlockInitiated` with `currentSessionId`, `label`, `commandText`, `metaContext`; `CancellationRequested` with no extra fields; `SessionSwitched` with `epoch` field.
  - **Assert:** All satisfy `SessionEvent`. `MetaContextCreated` is NOT in the union.

## Infrastructure: dispatch + processors + appendReplay

### appendReplay adds events without notifying subscribers

- **Level:** unit
- **Status:** extend
- **File:** `server/event-store.test.ts`
- **Covers:** Infrastructure step 3 — `appendReplay` method
- **Scenario:**
  - **Arrange:** Create an `EventStore`, register a subscriber, track received events.
  - **Act:** Call `store.appendReplay("s1", { type: "AgentText", text: "replayed" })`.
  - **Assert:** `store.getAll()` contains the event with correct `seq` and `sessionId`. `store.getBySessionId("s1")` contains it. The subscriber received zero events.

### appendReplay shares seq space with append

- **Level:** unit
- **Status:** extend
- **File:** `server/event-store.test.ts`
- **Covers:** Infrastructure step 3 — seq monotonicity
- **Scenario:**
  - **Arrange:** Create an `EventStore`.
  - **Act:** `store.append("s1", ...)` → seq 1. `store.appendReplay("s1", ...)` → seq 2. `store.append("s1", ...)` → seq 3.
  - **Assert:** Sequences are 1, 2, 3 respectively.

### dispatch routes a command to its handler and emits the correct event

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** Infrastructure steps 1, 4 — dispatch routing and event emission
- **Scenario:**
  - **Arrange:** Create an `EventStore`, `SessionRegistry`, `MetaContextRegistry`, and a mock `AcpBridge`. Call `createDispatch(store, registry, metaContextRegistry, bridge)`.
  - **Act:** `dispatch("s1", { type: "RecordAgentText", text: "hello" })`.
  - **Assert:** `store.getAll()` has exactly one event: `{ type: "AgentText", text: "hello", sessionId: "s1" }`.

### dispatch invokes registered processors after event emission

- **Level:** integration
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** Infrastructure steps 1-2 — processor invocation
- **Scenario:**
  - **Arrange:** Create dispatch context. Register a processor: `watches: "SessionCreated"`, handler records the event it received.
  - **Act:** `dispatch("s1", { type: "CreateSession" })` (with bridge.createSession mocked to return "s1").
  - **Assert:** The processor's handler was called with the `SessionCreated` event.

### dispatch does not invoke processors for non-matching events

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** Infrastructure step 2 — processor filtering
- **Scenario:**
  - **Arrange:** Create dispatch context. Register a processor watching `"SessionCreated"`, with a handler that increments a counter.
  - **Act:** `dispatch("s1", { type: "RecordAgentText", text: "hello" })`.
  - **Assert:** Counter is 0.

### processor can issue follow-on commands through dispatch

- **Level:** integration
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** Infrastructure steps 1-2 — processor chaining
- **Scenario:**
  - **Arrange:** Create dispatch context. Register a processor: watches `"SessionCreated"`, handler calls `dispatch(event.sessionId, { type: "RecordAgentText", text: "auto" })`.
  - **Act:** `dispatch("s1", { type: "CreateSession" })` (bridge mocked).
  - **Assert:** `store.getAll()` has two events: `SessionCreated` then `AgentText`.

## create-session: Create Session

### CreateSession command emits SessionCreated event

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** create-session step 1
- **Scenario:**
  - **Arrange:** Mock bridge returning `"new-session-id"` from `createSession()`. Wire dispatch with SessionRegistry.
  - **Act:** `dispatch("_", { type: "CreateSession" })`.
  - **Assert:** Store contains `SessionCreated` event with `sessionId: "new-session-id"`.

### AutoSwitchAfterCreate processor issues SwitchSession on SessionCreated

- **Level:** integration
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** create-session step 2
- **Scenario:**
  - **Arrange:** Wire dispatch with all processors registered.
  - **Act:** `dispatch("_", { type: "CreateSession" })` (bridge mocked).
  - **Assert:** Store contains `SessionCreated` followed by `SessionSwitched`.

## switch-session: Switch Session

### SwitchSession command emits SessionSwitched with epoch

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** switch-session step 1
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionCreated` for "s1". Create dispatch.
  - **Act:** `dispatch("s1", { type: "SwitchSession" })`.
  - **Assert:** Store contains `SessionSwitched` with `sessionId: "s1"` and a non-empty `epoch` string.

### SwitchSession rejects unknown session

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** switch-session step 1 — validation
- **Scenario:**
  - **Arrange:** Create dispatch with empty SessionRegistry.
  - **Act:** `dispatch("nonexistent", { type: "SwitchSession" })`.
  - **Assert:** Store contains `ErrorOccurred` event (or throws — depending on error strategy).

### LoadIfUnloaded processor issues LoadSession for unloaded session

- **Level:** integration
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** switch-session step 2
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionDiscovered` for "s1" (loaded: false). Wire dispatch with `LoadIfUnloaded` processor. Mock `bridge.loadSession`.
  - **Act:** `dispatch("s1", { type: "SwitchSession" })`.
  - **Assert:** `bridge.loadSession` was called with "s1". Store contains `SessionSwitched` then `SessionLoaded`.

### LoadIfUnloaded processor skips already-loaded sessions

- **Level:** integration
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** switch-session step 2 — conditional behavior
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionCreated` for "s1" (loaded: true). Wire dispatch.
  - **Act:** `dispatch("s1", { type: "SwitchSession" })`.
  - **Assert:** `bridge.loadSession` was NOT called. Store contains only `SessionSwitched`.

## load-session: Load Session

### LoadSession command calls bridge and emits SessionLoaded

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** load-session steps 1-2
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionDiscovered` for "s1". Mock `bridge.loadSession` to resolve. Create dispatch.
  - **Act:** `dispatch("s1", { type: "LoadSession" })`.
  - **Assert:** `bridge.loadSession` was called with "s1". Store contains `SessionLoaded`.

### LoadSession does not emit synthetic TurnCompleted

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** load-session step 2 — eliminates TurnCompleted hack
- **Scenario:**
  - **Arrange:** Same as above.
  - **Act:** `dispatch("s1", { type: "LoadSession" })`.
  - **Assert:** Store events do NOT include any `TurnCompleted` event.

## discover-session: Discover Session

### DiscoverSession command emits SessionDiscovered

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** discover-session step 1
- **Scenario:**
  - **Arrange:** Create dispatch.
  - **Act:** `dispatch("s1", { type: "DiscoverSession", name: "Session 1", title: "My Title", createdAt: 1000 })`.
  - **Assert:** Store contains `SessionDiscovered` with matching fields.

## submit-prompt: Submit Prompt

### SubmitPrompt command emits PromptSubmitted and calls bridge

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** submit-prompt step 1
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionCreated` for "s1" (loaded: true). Mock `bridge.submitPrompt`. Create dispatch.
  - **Act:** `dispatch("s1", { type: "SubmitPrompt", text: "hello", images: undefined })`.
  - **Assert:** Store contains `PromptSubmitted` with `text: "hello"`. `bridge.submitPrompt` was called with `("s1", "hello", undefined, true)`.

### SubmitPrompt rejects unloaded session

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** submit-prompt step 1 — validation
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionDiscovered` for "s1" (loaded: false). Create dispatch.
  - **Act:** `dispatch("s1", { type: "SubmitPrompt", text: "hello" })`.
  - **Assert:** Store does NOT contain `PromptSubmitted`. Error is signaled (via `ErrorOccurred` event or thrown).

## cancel-prompt: Cancel Prompt

### CancelPrompt command emits CancellationRequested and calls bridge

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** cancel-prompt steps 1-2
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionCreated` for "s1". Mock `bridge.cancel`. Create dispatch.
  - **Act:** `dispatch("s1", { type: "CancelPrompt" })`.
  - **Assert:** Store contains `CancellationRequested` with `sessionId: "s1"`. `bridge.cancel` was called with "s1".

## next-block-click pipeline

### NextBlockClick command emits NextBlockInitiated

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** next-block-click step 2
- **Scenario:**
  - **Arrange:** Pre-populate store with `SessionCreated` for "s1". Create dispatch.
  - **Act:** `dispatch("s1", { type: "NextBlockClick", currentSessionId: "s1", label: "Continue", commandText: "/plan my-spec", metaContext: "Feature: Login" })`.
  - **Assert:** Store contains `NextBlockInitiated` with all fields.

### Full next-block-click pipeline produces correct event sequence

- **Level:** integration
- **Status:** extend
- **File:** `server/next-block-click.test.ts`
- **Covers:** next-block-click steps 2-8, ensure-meta-context steps 3-4, create-session steps 2-3, add-session-to-meta-context step 7
- **Scenario:**
  - **Arrange:** Create full dispatch context with all processors wired. Mock `bridge.createSession` to return "new-s1". Mock `bridge.submitPrompt`.
  - **Act:** `dispatch("origin-s1", { type: "NextBlockClick", currentSessionId: "origin-s1", label: "Continue", commandText: "/plan feat", metaContext: "Feature: Login" })`.
  - **Assert:** Store events in order: `NextBlockInitiated` → `MetaContextEnsured` (created: true) → `SessionCreated` → `SessionSwitched` → `SessionAddedToMetaContext` → `PromptSubmitted`. `bridge.submitPrompt` was called with the `commandText`.

### Next-block-click reuses existing meta-context

- **Level:** integration
- **Status:** extend
- **File:** `server/next-block-click.test.ts`
- **Covers:** next-block-click step 4 — `MetaContextEnsured` with `created: false`
- **Scenario:**
  - **Arrange:** Pre-populate store with `MetaContextEnsured` for "Feature: Login" (created: true). Wire dispatch.
  - **Act:** `dispatch("origin-s2", { type: "NextBlockClick", ..., metaContext: "Feature: Login" })`.
  - **Assert:** Store contains `MetaContextEnsured` with `created: false` and the same `metaContextId`.

## ensure-meta-context: MetaContextEnsured projection

### metaContextEnsuredSlice creates entry when created is true

- **Level:** unit
- **Status:** extend
- **File:** `server/slices/meta-context-created.test.ts` (renamed to `meta-context-ensured.test.ts`)
- **Covers:** ensure-meta-context step 1 — created: true path
- **Scenario:**
  - **Arrange:** Start with `initialMetaContextRegistryState`.
  - **Act:** Apply `MetaContextEnsured` event with `created: true`, `metaContextId: "mc-1"`, `metaContextName: "Feature Work"`.
  - **Assert:** `contexts` has entry for "mc-1" with correct name. `nameIndex` maps "Feature Work" → "mc-1".

### metaContextEnsuredSlice is no-op when created is false

- **Level:** unit
- **Status:** new
- **File:** `server/slices/meta-context-ensured.test.ts`
- **Covers:** ensure-meta-context step 1 — created: false path
- **Scenario:**
  - **Arrange:** Start with state that already has "mc-1" in contexts.
  - **Act:** Apply `MetaContextEnsured` event with `created: false`, `metaContextId: "mc-1"`.
  - **Assert:** State is unchanged (same reference).

### MetaContextRegistry processes MetaContextEnsured events

- **Level:** integration
- **Status:** extend
- **File:** `server/projections/meta-context-registry.test.ts`
- **Covers:** ensure-meta-context step 3 — projection subscribes to renamed event
- **Scenario:**
  - **Arrange:** Create `EventStore` and `MetaContextRegistry`.
  - **Act:** `store.append("s1", { type: "MetaContextEnsured", metaContextId: "mc-1", metaContextName: "Feature Work", originSessionId: "s1", commandText: "/plan", created: true })`.
  - **Assert:** `registry.getState().contexts.get("mc-1")` exists with correct name.

## Bridge pass-through slices (batch)

### translateAcpToCommands returns command objects instead of event payloads

- **Level:** unit
- **Status:** extend
- **File:** `server/acp-translate.test.ts`
- **Covers:** Bridge pass-through step 2 — return type change
- **Scenario:**
  - **Arrange:** Import renamed `translateAcpToCommands`.
  - **Act:** Call with `agent_message_chunk` update containing text "hello".
  - **Assert:** Returns `[{ type: "RecordAgentText", text: "hello" }]` (command, not event payload).

### translateAcpToCommands maps all ACP update types to commands

- **Level:** unit
- **Status:** extend
- **File:** `server/acp-translate.test.ts`
- **Covers:** Bridge pass-through step 2 — all mappings
- **Scenario:**
  - **Arrange:** Import `translateAcpToCommands`.
  - **Act:** Call for each ACP update type: `agent_message_chunk` → `RecordAgentText`, `agent_thought_chunk` → `RecordAgentThought`, `tool_call` → `RecordToolCallStarted`, `tool_call_update` (in_progress) → `RecordToolCallUpdated`, `tool_call_update` (completed) → `RecordToolCallCompleted`, `plan` → `RecordPlanUpdated`, `usage_update` → `RecordUsageUpdated`, `session_info_update` → `RecordSessionInfoUpdated`.
  - **Assert:** Each returns the correctly typed command with all fields.

### RecordAgentText command emits AgentText event

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** Bridge pass-through step 1 — representative pass-through
- **Scenario:**
  - **Arrange:** Create dispatch.
  - **Act:** `dispatch("s1", { type: "RecordAgentText", text: "hello" })`.
  - **Assert:** Store contains `{ type: "AgentText", text: "hello", sessionId: "s1" }`.

### CompleteTurn command emits TurnCompleted event

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** Bridge pass-through step 1 — TurnCompleted path
- **Scenario:**
  - **Arrange:** Create dispatch.
  - **Act:** `dispatch("s1", { type: "CompleteTurn", stopReason: "end_turn" })`.
  - **Assert:** Store contains `{ type: "TurnCompleted", stopReason: "end_turn", sessionId: "s1" }`.

### RecordError command emits ErrorOccurred event

- **Level:** unit
- **Status:** new
- **File:** `server/dispatch.test.ts`
- **Covers:** Bridge pass-through step 1 + New Types step 3 — renamed error event
- **Scenario:**
  - **Arrange:** Create dispatch.
  - **Act:** `dispatch("s1", { type: "RecordError", message: "something broke" })`.
  - **Assert:** Store contains `{ type: "ErrorOccurred", message: "something broke", sessionId: "s1" }`.

## Client-side rename: Error to ErrorOccurred

### Client error slice handles ErrorOccurred type

- **Level:** unit
- **Status:** extend
- **File:** `client/reducer.test.ts`
- **Covers:** Client-side rename steps 1-2
- **Scenario:**
  - **Arrange:** Import `applyEvent` and `initialState`. Create state with `isProcessing: true`.
  - **Act:** Apply event `{ type: "ErrorOccurred", message: "boom", sessionId: "s1", seq: 2, timestamp: Date.now() }`.
  - **Assert:** `state.error === "boom"` and `state.isProcessing === false`.

### Client error slice no longer responds to type "Error"

- **Level:** unit
- **Status:** extend
- **File:** `client/reducer.test.ts`
- **Covers:** Client-side rename — old type removed
- **Scenario:**
  - **Arrange:** Import `applyEvent` and `initialState`.
  - **Act:** Apply event with `type: "Error"` (if type still compiles as a valid event, pass it through).
  - **Assert:** `state.error` remains `null` — the old type string is not handled.

## WS handler refactor: index.ts

### WS submit_prompt maps to dispatch SubmitPrompt

- **Level:** integration
- **Status:** new
- **File:** `server/ws-handler.test.ts`
- **Covers:** WS handler step 1
- **Scenario:**
  - **Arrange:** Create a mock dispatch function and a WS handler that routes `submit_prompt` to dispatch. Set `wsState.currentSessionId = "s1"`.
  - **Act:** Send JSON `{ "command": "submit_prompt", "text": "hello" }`.
  - **Assert:** `dispatch` was called with `("s1", { type: "SubmitPrompt", text: "hello" })`.

### WS create_session maps to dispatch CreateSession

- **Level:** integration
- **Status:** new
- **File:** `server/ws-handler.test.ts`
- **Covers:** WS handler step 1
- **Scenario:**
  - **Arrange:** Create mock dispatch and WS handler.
  - **Act:** Send JSON `{ "command": "create_session" }`.
  - **Assert:** `dispatch` was called with `{ type: "CreateSession" }`.

### WS switch_session maps to dispatch SwitchSession

- **Level:** integration
- **Status:** new
- **File:** `server/ws-handler.test.ts`
- **Covers:** WS handler step 1
- **Scenario:**
  - **Arrange:** Create mock dispatch and WS handler.
  - **Act:** Send JSON `{ "command": "switch_session", "sessionId": "s2" }`.
  - **Assert:** `dispatch` was called with `("s2", { type: "SwitchSession" })`.

### WS cancel maps to dispatch CancelPrompt

- **Level:** integration
- **Status:** new
- **File:** `server/ws-handler.test.ts`
- **Covers:** WS handler step 1
- **Scenario:**
  - **Arrange:** Create mock dispatch and WS handler. Set `wsState.currentSessionId = "s1"`.
  - **Act:** Send JSON `{ "command": "cancel" }`.
  - **Assert:** `dispatch` was called with `("s1", { type: "CancelPrompt" })`.

### WS next_block_click maps to dispatch NextBlockClick

- **Level:** integration
- **Status:** new
- **File:** `server/ws-handler.test.ts`
- **Covers:** WS handler step 4
- **Scenario:**
  - **Arrange:** Create mock dispatch and WS handler. Set `wsState.currentSessionId = "s1"`.
  - **Act:** Send JSON `{ "command": "next_block_click", "label": "Continue", "commandText": "/plan x", "metaContext": "Feature" }`.
  - **Assert:** `dispatch` was called with `("s1", { type: "NextBlockClick", currentSessionId: "s1", label: "Continue", commandText: "/plan x", metaContext: "Feature" })`.

### WS handler contains no business logic

- **Level:** integration
- **Status:** new
- **File:** `server/ws-handler.test.ts`
- **Covers:** WS handler steps 1-5 — no inline store.append or bridge calls
- **Scenario:**
  - **Arrange:** Create mock dispatch that records all calls. Wire WS handler with the mock.
  - **Act:** Send each of the 5 WS command types.
  - **Assert:** For each command, exactly one `dispatch` call was made. No direct `store.append` or `bridge.*` calls (verified via mock — store and bridge have zero interactions).

## Dead code removal

### PermissionRequested not in SessionEvent union

- **Level:** unit
- **Status:** new
- **File:** `server/types.test.ts`
- **Covers:** Dead code removal steps 1-2
- **Scenario:**
  - **Arrange:** Import `SessionEvent`.
  - **Act:** Compile-time check — the test file does not reference `PermissionRequested` or `PermissionOption`.
  - **Assert:** Compilation succeeds. (Covered by the "New Types" compile tests above — listed here for traceability.)

### permission_response not in WsCommand union

- **Level:** unit
- **Status:** new
- **File:** `server/types.test.ts`
- **Covers:** Dead code removal step 3
- **Scenario:**
  - **Arrange:** Import `WsCommand`.
  - **Act:** Compile-time check — `permission_response` is not a valid `command` discriminant.
  - **Assert:** Compilation succeeds. (Covered by the "WsCommand" compile test above — listed here for traceability.)
