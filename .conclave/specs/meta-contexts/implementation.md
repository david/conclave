# Meta-Contexts — Implementation

Group ACP sessions under named meta-contexts so multi-phase workflows (spec pipeline, etc.) appear as a single logical unit. The implementation adds two new domain events (`MetaContextCreated`, `SessionAddedToMetaContext`), a persistent server-side projection (`MetaContextRegistry`), a new `next_block_click` command, a `conclave:next` block renderer on the client, and grouped options in the session picker.

## New Types

### Server — `server/types.ts`

```ts
// New domain events (session-scoped)
export type MetaContextCreated = BaseEvent & {
  type: "MetaContextCreated";
  metaContextId: string;
  name: string;
};

export type SessionAddedToMetaContext = BaseEvent & {
  type: "SessionAddedToMetaContext";
  metaContextId: string;
  sessionId: string;
};

// Add to SessionEvent union:
//   | MetaContextCreated
//   | SessionAddedToMetaContext

// New command
export type NextBlockClickCommand = {
  command: "next_block_click";
  label: string;
  commandText: string;   // "command" in the schema, renamed to avoid keyword clash
  metaContext: string;
};

// Add to Command union:
//   | NextBlockClickCommand
```

### Server — `server/server-state.ts`

```ts
export type MetaContextMeta = {
  id: string;
  name: string;
  sessionIds: string[];   // ordered, most recent last
};

export type MetaContextRegistryState = {
  contexts: Map<string, MetaContextMeta>;    // id → meta
  nameIndex: Map<string, string>;            // name → id
};

export const initialMetaContextRegistryState: MetaContextRegistryState = {
  contexts: new Map(),
  nameIndex: new Map(),
};
```

### Server — `SessionListEvent` extension in `server/types.ts`

```ts
export type MetaContextInfo = {
  id: string;
  name: string;
  sessionIds: string[];
};

export type SessionListEvent = {
  type: "SessionList";
  sessions: Array<{ sessionId: string; name: string; title: string | null; firstPrompt: string | null }>;
  metaContexts: MetaContextInfo[];   // NEW
  seq: -1;
  timestamp: number;
};
```

### Client — `client/types.ts`

```ts
export type MetaContextInfo = {
  id: string;
  name: string;
  sessionIds: string[];
};

// Add to AppState:
//   metaContexts: MetaContextInfo[];

// Add to initialState:
//   metaContexts: [],
```

### Conclave skill — `.claude/skills/conclave/references/next.md`

New reference file defining the `conclave:next` block schema (label, command, metaContext fields).

---

## UC-4: Render conclave:next block as button

**Files:**
- `.claude/skills/conclave/references/next.md` — create schema reference
- `client/components/next-block-button.tsx` — new component
- `client/components/markdown-text.tsx` — add `conclave:next` handler to the `components.pre` logic
- `client/style.css` — button styles

**Steps:**
1. Create `.claude/skills/conclave/references/next.md` defining the block schema: `{ label: string, command: string, metaContext: string }`. Document that `metaContext` is required and blocks without it render a warning.
2. Create `client/components/next-block-button.tsx` exporting `NextBlockButton({ label, command, metaContext, onRun, disabled })`. Renders a styled button showing the `label` text. When clicked, calls `onRun({ label, command, metaContext })`. Accepts a `disabled` prop to grey out the button.
3. In `client/components/markdown-text.tsx`, add a `conclave:next` branch in the `components.pre` handler (same pattern as `conclave:usecase` and `conclave:eventmodel`). Parse the JSON, validate it has `label` and `command` fields. If valid and has `metaContext`, render `<NextBlockButton>`. If missing `metaContext`, render a warning message. If invalid JSON, fall through to normal code block.
4. The `onRun` callback must be threaded from the App root so it can send the WS command. `MarkdownText` needs a new optional prop `onNextBlockClick`. Pass it down through `MessageList` → `MarkdownText`.
5. Add CSS for `.next-block-btn` in `client/style.css`: accent-colored button, hover/active states, disabled state (greyed out, `pointer-events: none`).

**Tests:**
- `client/components/next-block-button.test.ts` — renders with label text, calls onRun on click, does not call onRun when disabled.

---

## UC-9: Warn on conclave:next without metaContext (extends UC-4)

**Files:**
- `client/components/markdown-text.tsx` — already covered in UC-4 step 3

**Steps:**
1. In the `conclave:next` handler in `markdown-text.tsx`, when the parsed JSON has `label` and `command` but no `metaContext` field, render a warning inline: a muted-text span saying "Next block missing metaContext" (or similar), without a clickable button.

**Tests:**
- `client/components/next-block-button.test.ts` — add a test that a block without `metaContext` does not render a button (tested at the markdown-text level or via a separate warning component).

---

## UC-3: Disable next-block buttons for past and clicked states

**Files:**
- `client/components/next-block-button.tsx` — add `useState` for clicked
- `client/components/markdown-text.tsx` — determine replay vs. live context

**Steps:**
1. In `NextBlockButton`, add local `useState(false)` for `clicked`. On click, set `clicked = true` before calling `onRun`. When `clicked` is true, render as disabled.
2. `MarkdownText` receives an `isReplay` prop (boolean). When `isReplay` is true, all `conclave:next` buttons render as disabled. `MessageList` sets `isReplay` per message: messages from replayed history (not the current streaming turn) pass `isReplay={true}`. The simplest heuristic: messages that arrived before the current streaming boundary (i.e. messages already in `state.messages` when the component mounts, or all messages when `isProcessing` is false) are replay. A pragmatic approach: pass `isReplay={!isProcessing || messageIndex < messages.length - 1}` — any message that isn't the last assistant message while streaming is replay. Simpler still: always disable buttons in non-streaming messages, and let the `clicked` state handle the live message.
3. Since messages from replayed sessions (after `SessionSwitched`) are always in `state.messages` (not streaming), all their buttons are automatically disabled by the isReplay logic.

**Tests:**
- Button disables after click (local state).
- Buttons in replayed messages render disabled.

---

## UC-8: Broadcast meta-context list to clients

**Files:**
- `server/types.ts` — new event types (see New Types above)
- `server/server-state.ts` — new `MetaContextRegistryState` (see New Types above)
- `server/slices/meta-context-created.ts` — new slice
- `server/slices/session-added-to-meta-context.ts` — new slice
- `server/slices/index.ts` — register new slices (in a new meta-context reducer, not the session-registry reducer)
- `server/projections/meta-context-registry.ts` — new projection with JSON write-through
- `server/projections/session-list.ts` — extend `buildSessionList()` to include metaContexts
- `server/index.ts` — create meta-context projection on startup, pass to session-list

**Steps:**
1. Add `MetaContextCreated` and `SessionAddedToMetaContext` to the `SessionEvent` union in `server/types.ts`. Add `MetaContextInfo` type and `metaContexts` field to `SessionListEvent`. Add `NextBlockClickCommand` to the `Command` union. Add both new event types to `EventPayload` (they're already included via `SessionEvent`).
2. Add `MetaContextMeta`, `MetaContextRegistryState`, and `initialMetaContextRegistryState` to `server/server-state.ts`.
3. Create `server/slices/meta-context-created.ts`: if event type is `MetaContextCreated`, add entry to `contexts` map and `nameIndex`. Signature: `(MetaContextRegistryState, DomainEvent) => MetaContextRegistryState`.
4. Create `server/slices/session-added-to-meta-context.ts`: if event type is `SessionAddedToMetaContext`, append `sessionId` to the context's `sessionIds` array.
5. Create `server/slices/meta-context-index.ts` — combine the two meta-context slices into a `metaContextRegistryReducer`, same pattern as `server/slices/index.ts` for session registry.
6. Create `server/projections/meta-context-registry.ts`: A custom projection (not using the generic `Projection` class) that hydrates from `.conclave/state/meta-contexts.json` on construction, then subscribes to the EventStore. On each relevant event, update in-memory state via the reducer and write through to the JSON file. Export `createMetaContextRegistry(store, cwd)` returning an object with `getState()`.
7. Extend `buildSessionList()` in `server/projections/session-list.ts` to accept the meta-context registry and include a `metaContexts` array in the returned `SessionListEvent`.
8. In `server/index.ts`, create the meta-context registry after the EventStore, pass it to `buildSessionList()` calls and `createSessionListProjection`.
9. Add `MetaContextCreated` and `SessionAddedToMetaContext` to `SESSION_AFFECTING_EVENTS` in `session-list.ts` so that meta-context changes trigger a broadcast.

**Tests:**
- `server/slices/meta-context-created.test.ts` — creates entry in state from event.
- `server/slices/session-added-to-meta-context.test.ts` — appends session ID to existing context.
- `server/projections/meta-context-registry.test.ts` — hydrates from JSON, processes events, writes through.

---

## UC-5: Display meta-contexts as groups in session picker

**Files:**
- `client/types.ts` — add `MetaContextInfo` type, `metaContexts` field to `AppState`
- `client/slices/session-list.ts` — store `metaContexts` from `SessionList` event
- `client/components/session-picker.tsx` — switch from flat options to grouped options

**Steps:**
1. Add `MetaContextInfo` type and `metaContexts: MetaContextInfo[]` to `AppState` in `client/types.ts`. Set initial value to `[]`.
2. Update `client/slices/session-list.ts` to also store `event.metaContexts ?? []` into `state.metaContexts`.
3. Refactor `SessionPicker` to use react-select's `GroupedOptionsType`. Build two groups:
   - **"Specs"** group: one option per meta-context, with `value` = meta-context id (prefixed `mc:` to distinguish from session IDs), `label` = meta-context name.
   - **"Sessions"** group: standalone sessions (those whose `sessionId` does not appear in any meta-context's `sessionIds`). Same label logic as today.
4. Update the `currentValue` derivation: if the current `sessionId` belongs to a meta-context, select the meta-context option. Otherwise select the session option.
5. Update `onChange`: if the selected value starts with `mc:`, resolve to the last `sessionId` in that meta-context's `sessionIds` array and call `onSwitch(resolvedSessionId)`. Otherwise call `onSwitch(value)` as before.
6. Add `metaContexts` to the `SessionPicker` props and pass it from `Chat`.
7. Add group header styles to the react-select `styles` config.

**Tests:**
- `client/components/session-picker.test.ts` — renders grouped options, resolves meta-context selection to most recent session ID.

---

## UC-6: Switch to a meta-context

**Files:**
- `client/components/session-picker.tsx` — already handled in UC-5 step 5
- `client/slices/session-switched.ts` — preserve `metaContexts` across session switches

**Steps:**
1. In `client/slices/session-switched.ts`, add `metaContexts: state.metaContexts` to the reset object (same pattern as `sessions`, `specs`, `gitFiles`).
2. No server changes needed — the client resolves meta-context → session ID and sends a standard `switch_session` command.

**Tests:**
- `client/slices/session-switched.test.ts` — verify `metaContexts` is preserved after SessionSwitched.

---

## UC-1 + UC-2: Create / add session to meta-context on next-block click

**Files:**
- `server/types.ts` — already done in UC-8 (command + event types)
- `server/index.ts` — add `next_block_click` command handler
- `client/index.tsx` — wire `onNextBlockClick` callback to WS command

**Steps:**
1. In `server/index.ts`, add a `case "next_block_click"` handler in the WebSocket message switch:
   a. Read `cmd.metaContext` (the name), `cmd.commandText` (the prompt), `cmd.label`.
   b. Look up the meta-context by name in the meta-context registry's `nameIndex`.
   c. If not found: generate a new `metaContextId` (e.g. `crypto.randomUUID()`), emit `MetaContextCreated` event (use the ws client's current session ID as the event's sessionId — it's the session where the button was clicked).
   d. Create a new ACP session via `bridge.createSession()`.
   e. Emit `SessionCreated` for the new session.
   f. Emit `SessionAddedToMetaContext` with the `metaContextId` and new `sessionId`.
   g. Send `SessionSwitched` to the clicking client, subscribe WS to the new session, replay.
   h. Submit the prompt: `store.append(newSessionId, { type: "PromptSubmitted", text: cmd.commandText })` then `bridge.submitPrompt(newSessionId, cmd.commandText, undefined, true)`.
2. If the meta-context already exists (UC-2), skip step (c) and use the existing `metaContextId` for step (f). All other steps are identical.
3. In `client/index.tsx`, add a `handleNextBlockClick` callback that sends `{ command: "next_block_click", label, commandText, metaContext }` over WebSocket. Pass it through to `Chat` → `MessageList` → `MarkdownText` as the `onNextBlockClick` prop.

**Tests:**
- `server/index.ts` integration test (or a focused handler test): next_block_click with new meta-context creates MetaContextCreated + SessionCreated + SessionAddedToMetaContext events.
- Same command with existing meta-context name skips MetaContextCreated, still emits SessionAddedToMetaContext.

---

## Implementation Order

1. **New Types** — server/types.ts, server/server-state.ts, client/types.ts (foundation, no behavior)
2. **UC-8** — Meta-context projection + session list broadcast (server infra for all other UCs)
3. **UC-4 + UC-9** — conclave:next rendering + warning (client-only, no server dependency)
4. **UC-3** — Button disable states (extends UC-4, client-only)
5. **UC-5 + UC-6** — Grouped session picker + meta-context switching (client, depends on UC-8 for data)
6. **UC-1 + UC-2** — next_block_click command handler (server + client wiring, depends on UC-8 for projection and UC-4 for button)
