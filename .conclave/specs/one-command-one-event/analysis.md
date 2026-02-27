# One Command, One Event — Analysis

Refactor the server's command handling to enforce a strict one-command-one-event discipline. Every command produces exactly one event, every event enters the store through a command, and multi-step workflows are decomposed into processor-connected slice pipelines. The ACP bridge becomes a command issuer rather than writing events directly into the store.

## Decisions

### 1. Single `dispatch(sessionId, command)` entry point

All commands — user-originated (WS messages) and bridge-originated (ACP translations) — go through a single dispatch function. The WS handler parses JSON and calls dispatch. The bridge builds command objects and calls dispatch. One path, one place for cross-cutting concerns (logging, validation, error handling).

### 2. Processors watch events, not projections

Processors subscribe to the event stream and pattern-match on event types. They do not poll projections. This is simpler and avoids the indirection of projecting state just to trigger a downstream command.

### 3. `SessionSwitched` becomes a stored domain event

Promoted from a `seq: -1` WS-only signal to a real stored event. `SwitchSession` command produces `SessionSwitched` event. The `create-session` and `next-block-click` pipelines end with a `SwitchSession` step via processor. Every user-visible state change is a recorded fact.

### 4. `SessionListEvent` elimination is a separate follow-on

This refactor focuses on the command layer. The `SessionListEvent` broadcast mechanism stays as-is for now. Replacing it with individual global event reduction on the client is a distinct spec (noted in research.md as an open question).

### 5. Replay uses `store.appendReplay` — no subscriber notification

During `loadSession`, the ACP subprocess replays history. Replayed events enter the store via a new `appendReplay` method that adds to the log without notifying subscribers. Projections replay from the full log on construction (they already do). Processors only fire on live events.

### 6. `CancelPrompt` command produces `CancellationRequested` event

Cancellation becomes a recorded fact. The bridge still calls `connection.cancel()` as a side effect, but the event is the source of truth.

### 7. `LoadSession` is its own command

Eliminates the synthetic `TurnCompleted` hack. The `switch-session` slice has a `LoadIfUnloaded` processor that conditionally issues `LoadSession` when the target session isn't loaded yet. The load command handler calls `bridge.loadSession()` and produces `SessionLoaded`.

### 8. `next-block-click` decomposes into a processor pipeline

The monolithic `next_block_click` handler becomes a pipeline:
1. `NextBlockClick` command → `NextBlockInitiated` event
2. `EnsureMetaContext` processor → `EnsureMetaContext` command → `MetaContextEnsured` event
3. `CreateSessionForMetaContext` processor → `CreateSession` command → `SessionCreated` event
4. Two processors fire in parallel on `SessionCreated`:
   - `AutoSwitchAfterCreate` → `SwitchSession` → `SessionSwitched`
   - `AssociateWithMetaContext` → `AddSessionToMetaContext` → `SessionAddedToMetaContext`
5. `SubmitPromptForNextBlock` processor watches `SessionAddedToMetaContext` → `SubmitPrompt` → `PromptSubmitted`

The `commandText` field flows through the pipeline: `NextBlockInitiated` → `MetaContextEnsured` → `AddSessionToMetaContext` → `SessionAddedToMetaContext`, where the final processor uses it to issue `SubmitPrompt`.

The `MetaContextCreated` and `SessionAddedToMetaContext` events from the current model are consolidated into `MetaContextEnsured` (which handles idempotent create-or-reuse) and `SessionAddedToMetaContext` (which explicitly associates sessions to contexts).

### 9. Bridge translation commands are thin pass-throughs

The `record-*` slices (agent-text, agent-thought, tool-call-started, etc.) have commands that mirror their events 1:1. No validations, no projections. Their purpose is to route bridge output through the command dispatch path so all events enter the store uniformly. The `acp-translate.ts` function changes from returning `EventPayload[]` to returning command objects.

### 10. Dead code removal

`permission_response` command and `PermissionRequested` event type are removed. The bridge auto-approves all permissions; there is no user-facing permission flow.

### 11. Error event renamed to `ErrorOccurred`

The current `Error` event type name collides with the JavaScript built-in. Renamed to `ErrorOccurred` for clarity. The `record-error` slice handles this.

### 12. "Screen" trigger for non-UI command issuers

The slice schema supports two trigger types: `screen` (external entry point) and `processor` (automation chain). The ACP bridge and server startup are not UI screens, but they are external entry points — they originate commands outside the processor pipeline. These use `{ "screen": "ACP Bridge" }` and `{ "screen": "Server Startup" }` respectively. The "screen" trigger means "command issued from outside the event-driven processor chain," not strictly "UI screen."

### 13. Bridge pass-through slices are a batch

The 10 `record-*` slices plus `complete-turn` are structurally identical: zero-validation commands that mirror all fields to a 1:1 event, with no projections and no processors. They exist to route bridge output through the unified dispatch path. The downstream planner should treat these as a single implementation batch — one generic pattern applied 11 times — rather than 11 independent tasks.

## NFRs

### Backward compatibility during transition

The refactor changes internal plumbing but must not alter observable behavior. The WebSocket protocol (event shapes sent to clients) remains identical. Client slices require no changes except for the `Error` → `ErrorOccurred` rename.

### No new dependencies

The dispatch function, processors, and command types are pure TypeScript. No new packages needed.
