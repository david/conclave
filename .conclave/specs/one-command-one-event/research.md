# One Command, One Event

Refactor the server's command handling to enforce a strict one-command-one-event discipline: every command produces exactly one event, every event enters the store through a command, and multi-step workflows are decomposed into processor-connected slice pipelines.

## Findings

### Current Command-to-Event Mapping

The server has six commands defined in `server/types.ts`. Their current event emission patterns:

| Command | Events Emitted | Pattern |
|---|---|---|
| `create_session` | `SessionCreated` | Clean 1:1 |
| `submit_prompt` | Conditionally `TurnCompleted` + `SessionLoaded`, then `PromptSubmitted` | 1:1 with inlined loading side-quest |
| `switch_session` | Conditionally `TurnCompleted` + `SessionLoaded` | 0-2 events, conditional |
| `cancel` | None (side-effect only) | 0 events |
| `next_block_click` | `MetaContextCreated` (conditional) + `SessionCreated` + `SessionAddedToMetaContext` + `PromptSubmitted` | 3-4 events from one command |
| `permission_response` | Dead code — no handler exists | N/A |

Only `create_session` currently follows the one-command-one-event rule.

### ACP Bridge Bypasses the Command Layer

The ACP bridge (`server/acp-bridge.ts`) receives `SessionUpdate` notifications from the Claude Code subprocess and translates them into domain events via `acp-translate.ts`. These events are written directly into the EventStore through the `onEvent` callback — there is no intermediate command. The bridge emits:

- `AgentText` — from `agent_message_chunk`
- `AgentThought` — from `agent_thought_chunk`
- `ToolCallStarted` — from `tool_call`
- `ToolCallUpdated` — from `tool_call_update` (in-progress)
- `ToolCallCompleted` — from `tool_call_update` (completed/failed)
- `PlanUpdated` — from `plan`
- `UsageUpdated` — from `usage_update`
- `SessionInfoUpdated` — from `session_info_update`
- `TurnCompleted` — emitted by `submitPrompt()` after `connection.prompt()` resolves
- `PromptSubmitted` — from `user_message_chunk` during session replay only
- `Error` — on prompt failure or cancel failure

Each of these should go through a proper command handler to maintain consistency.

### Synthetic and Infrastructure Events

- **Synthetic `TurnCompleted`**: The server fabricates `TurnCompleted` with `stopReason: "end_turn"` before `SessionLoaded` when loading sessions. This exists to reset the client's `isProcessing` flag. It's a workaround — loading should be its own concern.
- **`SessionSwitched`**: Sent over WebSocket with `seq: -1`, never stored in EventStore, but included in the `SessionEvent` type union. Currently a client-routing signal, not a domain event.
- **`SessionDiscovered`**: Emitted during startup when enumerating existing ACP sessions. No command triggers it — the server directly appends to the store.
- **`SessionListEvent`**: A derived broadcast — the server builds a full session list snapshot from `SessionRegistry` and `MetaContextRegistry` and pushes it to all clients with `seq: -1`. Triggered reactively when session-affecting events land, and on WS connect.

### Shared Projection Topology

Five server slices feed `SessionRegistryState`:
- `create-session.ts` handles `SessionCreated`
- `discover-session.ts` handles `SessionDiscovered`
- `load-session.ts` handles `SessionLoaded`
- `track-first-prompt.ts` handles `PromptSubmitted`
- `update-title.ts` handles `SessionInfoUpdated`

Two server slices feed `MetaContextRegistryState`:
- `meta-context-created.ts` handles `MetaContextCreated`
- `session-added-to-meta-context.ts` handles `SessionAddedToMetaContext`

The reducer-per-event-type pattern on the server side is already aligned with the target model. The slices themselves don't need restructuring — the command layer above them does.

### Client Slices Are Already Clean

All 18 client slices use the `createSlice` factory, each handling exactly one event type. No changes needed on the client side for this refactor.

### Dead Code

- `permission_response` command: defined in `Command` type union, no handler in the WebSocket switch. Falls through to "Unknown command" error.
- `PermissionRequested` event: defined in `SessionEvent` union, never emitted. The bridge auto-approves all permissions.

## Decisions

### 1. Single command dispatch function

All commands — user-originated (from WS) and bridge-originated (from ACP translations) — go through a single `dispatch(sessionId, command)` function. The WS message handler parses JSON and calls dispatch. The bridge builds command objects and calls dispatch. One path, one place for cross-cutting concerns.

### 2. Processors watch events, not projections

The event modeler skill describes processors as watching projections. We diverge from that: processors subscribe to the event stream and pattern-match on event types. This is simpler and avoids the indirection of projecting state just to trigger a downstream command. The event modeler skill definition should be updated to reflect this.

### 3. `SessionSwitched` becomes a stored domain event

Promoted from a `seq: -1` WS-only signal to a real stored event. `SwitchSession` command → `SessionSwitched` event. `CreateSession` and the `next_block_click` pipeline end with a `SwitchSession` step via a processor. This means every user-visible state change is a recorded fact.

### 4. Eliminate `SessionListEvent` — split into global and session event streams

Session lifecycle events (`SessionCreated`, `SessionDiscovered`, `SessionLoaded`, `SessionInfoUpdated`, `MetaContextCreated`, `SessionAddedToMetaContext`, `SessionSwitched`) become global events. They describe facts about the session registry, not about what happened inside a particular session.

The EventStore gets two streams:
- **Global events** — session lifecycle, specs, git status, services. Relayed to all clients. The client reduces them into its session list, meta-contexts, etc.
- **Session events** — things that happen inside a session (`PromptSubmitted`, `AgentText`, `ToolCallStarted`, etc.). Scoped to a session, replayed when switching to that session.

On WS connect, the client receives all global events (builds session list) plus session events for the active session (builds messages/state). `SessionListEvent` is eliminated — the client maintains its own session list projection from individual global events.

### 5. Replay uses `store.appendReplay` — no subscriber notification

During `loadSession`, the ACP subprocess replays history. Replayed events enter the store via `store.appendReplay`, which adds them to the log without notifying subscribers. Projections replay from the full log on construction (they already do this). Processors only fire on live events. This keeps the store owning the replay/live distinction — processors don't need to check flags.

### 6. `CancelPrompt` command → `CancellationRequested` event

Cancellation becomes a recorded fact in the event log.

### 7. `LoadSession` becomes its own command

`LoadSession` command → `SessionLoaded` event. Eliminates the synthetic `TurnCompleted` hack and the duplicated loading logic in `submit_prompt` and `switch_session`.

### 8. Clean up dead code

Remove `permission_response` command and `PermissionRequested` event type.

## Open Questions

- **Client-side session list projection**: The client currently replaces its session list wholesale from `SessionListEvent`. With that eliminated, the client needs to reduce individual global events (`SessionCreated`, `SessionInfoUpdated`, etc.) into a session list. The existing client slices for `SessionCreated` and `SessionInfoUpdated` handle some of this, but `session-list.ts` (which handles `SessionList` event type) would need to be replaced with individual reducers for each global event. This is a client-side follow-on, not a blocker for the server refactor.
