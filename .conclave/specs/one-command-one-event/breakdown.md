# One Command, One Event — Implementation

Refactor the server's command handling to enforce a strict one-command-one-event discipline. Introduce a `dispatch(sessionId, command)` function as the single entry point for all state changes. The ACP bridge and WS handler both issue commands through dispatch. Multi-step workflows (session loading, next-block-click pipeline) decompose into processor chains where each processor watches an event and issues a follow-on command. The EventStore gains `appendReplay` for replay-only writes that skip subscriber notification.

## New Types

**Files:**
- `server/types.ts` — modify existing

**Steps:**
1. Add a `Command` discriminated union for all server-side commands. This replaces the current WS-only `Command` type. New command types: `CreateSession`, `SwitchSession`, `LoadSession`, `DiscoverSession`, `SubmitPrompt`, `CancelPrompt`, `NextBlockClick`, `EnsureMetaContext`, `AddSessionToMetaContext`, `RecordAgentText`, `RecordAgentThought`, `RecordToolCallStarted`, `RecordToolCallUpdated`, `RecordToolCallCompleted`, `RecordPlanUpdated`, `RecordUsageUpdated`, `RecordSessionInfoUpdated`, `CompleteTurn`, `RecordError`. Each command type mirrors its slice definition's `commands[0].fields`.
2. Rename the existing WS-facing `Command` type to `WsCommand` (or `ClientCommand`) so the two don't collide. The WS message handler parses JSON into `WsCommand`, then maps each case to the appropriate server-side `Command` and calls `dispatch`.
3. Rename `ErrorEvent` (type `"Error"`) to `ErrorOccurred` (type `"ErrorOccurred"`). Update the `SessionEvent` union, `EventPayload`, and all server/client references.
4. Remove `PermissionRequested` event type and `PermissionResponseCommand` from the `WsCommand` union (dead code — analysis decision 10).
5. Add `MetaContextEnsured` event type (replaces `MetaContextCreated`): `{ type: "MetaContextEnsured"; metaContextId: string; metaContextName: string; originSessionId: string; commandText: string; created: boolean }`. Remove `MetaContextCreated`.
6. Add `NextBlockInitiated` event type: `{ type: "NextBlockInitiated"; currentSessionId: string; label: string; commandText: string; metaContext: string }`.
7. Add `CancellationRequested` event type: `{ type: "CancellationRequested" }` (session-scoped).
8. Promote `SessionSwitched` to a stored domain event with `epoch` field (currently sent with `seq: -1`).
9. Define a `Processor` type: `{ watches: DomainEvent["type"]; handler: (event: DomainEvent, dispatch: DispatchFn) => void }` — used by the dispatch infrastructure to wire processors.

## Infrastructure: dispatch + processors + appendReplay

**Files:**
- `server/dispatch.ts` — new file
- `server/event-store.ts` — modify existing

**Steps:**
1. Create `server/dispatch.ts` exporting `createDispatch(store, registry, metaContextRegistry, bridge)`. Returns a `dispatch(sessionId, command)` function. Internally:
   - A `switch` on `command.type` runs the command handler (validation + event emission via `store.append`).
   - After each `store.append`, iterate registered processors. Each processor checks the emitted event's type; if it matches `watches`, invoke `handler(event, dispatch)`. This is synchronous for processors that issue commands immediately, and async-aware for processors that need to `await` bridge calls (like `LoadSession` calling `bridge.loadSession`).
2. Export a `registerProcessor(watches, handler)` function on the dispatch context so slices can register their processors during wiring.
3. Add `EventStore.appendReplay(sessionId, payload)` — identical to `append` but does **not** notify subscribers. Used during `loadSession` so replayed events enter the log without triggering processors or live WS subscriptions. Projections that need replay data already replay from `store.getAll()` on construction.
4. Command handlers that need read model state (e.g., `SwitchSession` validating session exists) receive projections via closure from `createDispatch`.

## create-session: Create Session

**Files:**
- `server/dispatch.ts` — add command handler case

**Steps:**
1. `CreateSession` command handler: calls `bridge.createSession()`, then `store.append(sessionId, { type: "SessionCreated" })`. The `name` field is derived from `SessionRegistry.sessionCounter` via `nextNewSessionName()` (existing utility).
2. Register `AutoSwitchAfterCreate` processor: watches `SessionCreated`, issues `SwitchSession { sessionId }` to dispatch. This replaces the inline `sendWs(ws, { type: "SessionSwitched", ... })` in the current `create_session` handler.
3. Register `AssociateWithMetaContext` processor: watches `SessionCreated`, issues `AddSessionToMetaContext` if the create was triggered within a meta-context pipeline. The processor needs context about whether a meta-context is active — this is tracked in the `MetaContextEnsured` event's `commandText` field flowing through the pipeline. The processor checks pending meta-context state to determine if association is needed.

**Note:** The `AutoSwitchAfterCreate` and `AssociateWithMetaContext` processors both fire on `SessionCreated`. `AutoSwitchAfterCreate` always fires. `AssociateWithMetaContext` only fires when the create originated from the next-block-click pipeline. A pipeline context mechanism (see next-block-click section) distinguishes the two cases.

## switch-session: Switch Session

**Files:**
- `server/dispatch.ts` — add command handler case

**Steps:**
1. `SwitchSession` command handler: validate session exists in `SessionRegistry` (reject with error if not). Emit `SessionSwitched { sessionId, epoch }` where `epoch` is the server epoch UUID.
2. Register `LoadIfUnloaded` processor: watches `SessionSwitched`, checks `SessionRegistry` for loaded state. If `!meta.loaded`, issues `LoadSession { sessionId }`.
3. The WS layer (`index.ts`) subscribes to `SessionSwitched` events to trigger client-side session replay. This replaces the current inline `sendWs(ws, { type: "SessionSwitched", ... })` calls.

## load-session: Load Session

**Files:**
- `server/dispatch.ts` — add command handler case

**Steps:**
1. `LoadSession` command handler: validate session exists and is not already loaded (via `SessionRegistry`). Call `bridge.loadSession(sessionId)` — this triggers ACP replay, which feeds events through `appendReplay`. After `bridge.loadSession()` resolves, emit `SessionLoaded { sessionId }`.
2. This eliminates the synthetic `TurnCompleted` hack. Currently, `index.ts` emits `store.append(id, { type: "TurnCompleted", stopReason: "end_turn" })` before `SessionLoaded` — that goes away. If the client needs `isProcessing` reset, the `SessionLoaded` event itself should handle it (client-side slice concern).

## discover-session: Discover Session

**Files:**
- `server/dispatch.ts` — add command handler case

**Steps:**
1. `DiscoverSession` command handler: no validations. Emit `SessionDiscovered { sessionId, name, title, createdAt }`.
2. The server startup code in `index.ts` changes from `store.append(s.sessionId, { type: "SessionDiscovered", ... })` to `dispatch(s.sessionId, { type: "DiscoverSession", ... })`.

## submit-prompt: Submit Prompt

**Files:**
- `server/dispatch.ts` — add command handler case

**Steps:**
1. `SubmitPrompt` command handler: validate session exists and is loaded (via `SessionRegistry`). Emit `PromptSubmitted { sessionId, text, images }`. Then call `bridge.submitPrompt(sessionId, text, images, true)` — the `skipPromptEvent: true` flag stays since the command handler already emitted the event.
2. The WS `submit_prompt` case maps to `dispatch(sessionId, { type: "SubmitPrompt", sessionId, text, images })`. The inline session-loading logic is removed — if the session isn't loaded, validation rejects. The `LoadIfUnloaded` processor on `SessionSwitched` handles loading before the user can prompt.

## cancel-prompt: Cancel Prompt

**Files:**
- `server/dispatch.ts` — add command handler case

**Steps:**
1. `CancelPrompt` command handler: validate session exists. Emit `CancellationRequested { sessionId }`. Then call `bridge.cancel(sessionId)` as a side effect.
2. The WS `cancel` case maps to `dispatch(sessionId, { type: "CancelPrompt", sessionId })`.

## next-block-click + ensure-meta-context + add-session-to-meta-context: Next Block Pipeline

**Files:**
- `server/dispatch.ts` — add command handler cases
- `server/pipeline-context.ts` — new file

**Steps:**
1. Create `server/pipeline-context.ts`: a lightweight mechanism for passing context through a processor chain. When `NextBlockClick` fires, it stores `{ metaContextName, commandText, originSessionId }` keyed by a correlation ID. Processors down the chain retrieve this context to know they're part of the next-block pipeline (vs. a standalone create-session). The simplest implementation: a `Map<string, PipelineContext>` keyed by `metaContextId` or similar, populated when `NextBlockInitiated` is emitted, consumed when `SessionAddedToMetaContext` fires.
2. `NextBlockClick` command handler: validate current session exists. Emit `NextBlockInitiated { currentSessionId, label, commandText, metaContext }`.
3. Register `EnsureMetaContext` processor: watches `NextBlockInitiated`, issues `EnsureMetaContext { originSessionId, metaContextName, commandText }`.
4. `EnsureMetaContext` command handler: check `MetaContextRegistry.nameIndex` for existing context. If found, emit `MetaContextEnsured { metaContextId, metaContextName, originSessionId, commandText, created: false }`. If not found, generate UUID, emit `MetaContextEnsured { ..., created: true }`.
5. Register `CreateSessionForMetaContext` processor: watches `MetaContextEnsured`, issues `CreateSession`. Stores pipeline context so `AssociateWithMetaContext` knows to fire.
6. `AssociateWithMetaContext` processor (registered in create-session section): watches `SessionCreated`, checks pipeline context. If active, issues `AddSessionToMetaContext { sessionId, metaContextId, commandText }`.
7. `AddSessionToMetaContext` command handler: validate session exists and meta-context exists. Emit `SessionAddedToMetaContext { sessionId, metaContextId, commandText }`.
8. Register `SubmitPromptForNextBlock` processor: watches `SessionAddedToMetaContext`, retrieves `commandText` from the event, issues `SubmitPrompt { sessionId, text: commandText }`.

## ensure-meta-context: MetaContextEnsured projection update

**Files:**
- `server/slices/meta-context-created.ts` — rename to `server/slices/meta-context-ensured.ts`, update
- `server/slices/meta-context-index.ts` — update import
- `server/server-state.ts` — no change (MetaContextMeta shape stays)

**Steps:**
1. Rename `metaContextCreatedSlice` to `metaContextEnsuredSlice`. Change event type match from `"MetaContextCreated"` to `"MetaContextEnsured"`. When `created: true`, add to contexts and nameIndex (current behavior). When `created: false`, no-op for the registry (context already exists).
2. Update `meta-context-index.ts` to import from the renamed file.
3. Update `metaContextRegistry` in `server/projections/meta-context-registry.ts` to subscribe to `MetaContextEnsured` instead of `MetaContextCreated`.

## Bridge pass-through slices (batch): record-agent-text, record-agent-thought, record-tool-call-started, record-tool-call-updated, record-tool-call-completed, record-plan-updated, record-usage-updated, record-session-info-updated, complete-turn, record-error

**Files:**
- `server/dispatch.ts` — add 11 command handler cases
- `server/acp-translate.ts` — modify to return commands instead of event payloads
- `server/acp-bridge.ts` — modify to call dispatch instead of onEvent

**Steps:**
1. Add 11 pass-through command handler cases in `dispatch.ts`. Each is structurally identical: no validations, emit the 1:1 event. For example, `RecordAgentText { sessionId, text }` → `store.append(sessionId, { type: "AgentText", text })`. The `RecordError` handler emits `ErrorOccurred` (renamed event).
2. Change `acp-translate.ts`: rename `translateAcpUpdate` to `translateAcpToCommands` (or similar). Return type changes from `EventPayload[]` to server-side `Command[]`. Each case maps to the corresponding `Record*` command instead of an event payload. For example, `agent_message_chunk` → `[{ type: "RecordAgentText", sessionId, text }]`. The `TurnCompleted` emission in `acp-bridge.ts` (after `connection.prompt()` resolves) becomes `dispatch(sessionId, { type: "CompleteTurn", sessionId, stopReason })`.
3. Change `AcpBridge` constructor: replace `onEvent: OnEventCallback` with a dispatch function. The `sessionUpdate` callback in the connection client calls `translateAcpToCommands(update, isLoading)` and dispatches each returned command. During replay (`isLoading = true`), the bridge uses `store.appendReplay` instead of dispatch — replayed events bypass processors.
4. The `Error` emissions in `submitPrompt()` catch block and `cancel()` catch block become `dispatch(sessionId, { type: "RecordError", sessionId, message })`.

## Client-side rename: Error → ErrorOccurred

**Files:**
- `client/types.ts` — update `ClientEvent` references
- `client/slices/error.ts` — update event type match

**Steps:**
1. Update any client slice that matches on `type: "Error"` to match on `type: "ErrorOccurred"`.
2. The server still sends `ErrorOccurred` over WebSocket. Client slices process it identically — just the type string changes.

## WS handler refactor: index.ts

**Files:**
- `server/index.ts` — major refactor

**Steps:**
1. Replace the `message` handler's `switch` block: each `WsCommand` case maps to a `dispatch` call. The handler no longer contains business logic — it parses JSON, resolves `sessionId` from `wsState.currentSessionId`, builds the server-side `Command`, and calls `dispatch`.
2. The `open` handler's session-switching logic (currently inline) uses `dispatch(targetSessionId, { type: "SwitchSession", sessionId: targetSessionId })`. The `LoadIfUnloaded` processor handles loading. The WS layer subscribes to `SessionSwitched` events to trigger `subscribeWsToSession` and `replaySession`.
3. Remove the inline session-loading code from `submit_prompt` and `switch_session` handlers — this is now handled by `LoadSession` command via the `LoadIfUnloaded` processor.
4. The `next_block_click` handler reduces to `dispatch(currentSessionId, { type: "NextBlockClick", currentSessionId, label, commandText, metaContext })`. The entire pipeline (meta-context, create session, associate, switch, prompt) executes through processors.
5. `cancel` handler becomes `dispatch(sessionId, { type: "CancelPrompt", sessionId })`.
6. Startup code: `store.append(s.sessionId, { type: "SessionDiscovered", ... })` becomes `dispatch(s.sessionId, { type: "DiscoverSession", ... })`. `store.append(sessionId, { type: "SessionCreated" })` becomes `dispatch(sessionId, { type: "CreateSession" })` — but the bridge call happens inside the `CreateSession` handler now, so startup just calls `dispatch` directly.

## Dead code removal

**Files:**
- `server/types.ts` — remove types
- `server/index.ts` — remove handler case

**Steps:**
1. Remove `PermissionRequested` from the `SessionEvent` union.
2. Remove `PermissionOption` type.
3. Remove `PermissionResponseCommand` from the `WsCommand` union.
4. Remove the `permission_response` fallthrough in the WS message handler (currently falls to "Unknown command").
