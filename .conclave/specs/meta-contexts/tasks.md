# Meta-Contexts — Tasks

Five tasks across two waves. Wave 0 splits server infrastructure (T-0) from client rendering (T-1) with no file overlap, enabling full parallelism. Wave 1 runs three independent tasks — button disable states (T-2), session picker grouping (T-3), and the command handler + wiring (T-4) — all touching disjoint file sets.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Server types, slices, and meta-context projection",
    "ucs": ["UC-8"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [
        "server/slices/meta-context-created.ts",
        "server/slices/meta-context-created.test.ts",
        "server/slices/session-added-to-meta-context.ts",
        "server/slices/session-added-to-meta-context.test.ts",
        "server/slices/meta-context-index.ts",
        "server/projections/meta-context-registry.ts",
        "server/projections/meta-context-registry.test.ts"
      ],
      "modify": [
        "server/types.ts",
        "server/server-state.ts",
        "server/projections/session-list.ts",
        "server/index.ts",
        "client/types.ts"
      ]
    },
    "description": "Add MetaContextCreated and SessionAddedToMetaContext event types, NextBlockClickCommand, and MetaContextInfo to server/types.ts. Add MetaContextMeta, MetaContextRegistryState, and initialMetaContextRegistryState to server/server-state.ts. Add MetaContextInfo and metaContexts to client AppState. Create two meta-context slices (meta-context-created, session-added-to-meta-context) and their combined reducer (meta-context-index). Create the MetaContextRegistry projection with JSON write-through to .conclave/state/meta-contexts.json. Extend buildSessionList and createSessionListProjection in session-list.ts to include metaContexts. Wire up the meta-context registry in server/index.ts. Add MetaContextCreated and SessionAddedToMetaContext to SESSION_AFFECTING_EVENTS."
  },
  {
    "id": "T-1",
    "name": "Render conclave:next block as button with warning",
    "ucs": ["UC-4", "UC-9"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [
        ".claude/skills/conclave/references/next.md",
        "client/components/next-block-button.tsx",
        "client/components/next-block-button.test.ts"
      ],
      "modify": [
        "client/components/markdown-text.tsx",
        "client/style.css"
      ]
    },
    "description": "Create the conclave:next block schema reference file. Create NextBlockButton component with label, command, metaContext, onRun, and disabled props. Add conclave:next handler to markdown-text.tsx's components.pre logic — valid blocks with metaContext render as NextBlockButton, blocks missing metaContext render a warning, invalid JSON falls through to normal code block. Thread onNextBlockClick prop from MarkdownText through MessageList. Add .next-block-btn CSS styles."
  },
  {
    "id": "T-2",
    "name": "Disable next-block buttons for past and clicked states",
    "ucs": ["UC-3"],
    "depends": ["T-1"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": [
        "client/components/next-block-button.tsx",
        "client/components/markdown-text.tsx"
      ]
    },
    "description": "Add clicked local state to NextBlockButton — on click, set clicked=true before calling onRun, then render as disabled. Add isReplay prop to MarkdownText; when true, all conclave:next buttons render disabled. MessageList determines isReplay per message: any message that is not the last assistant message while streaming is replay. When isProcessing is false, all buttons are disabled. Test: button disables after click, buttons in replayed messages render disabled."
  },
  {
    "id": "T-3",
    "name": "Grouped session picker and meta-context switching",
    "ucs": ["UC-5", "UC-6"],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [
        "client/components/session-picker.test.ts"
      ],
      "modify": [
        "client/slices/session-list.ts",
        "client/slices/session-switched.ts",
        "client/components/session-picker.tsx",
        "client/components/chat.tsx"
      ]
    },
    "description": "Update client/slices/session-list.ts to store metaContexts from SessionList events. Preserve metaContexts across SessionSwitched in session-switched.ts. Refactor SessionPicker to use react-select GroupedOptionsType with two groups: 'Specs' (meta-contexts, value prefixed mc:) and 'Sessions' (standalone sessions not in any meta-context). Update currentValue derivation: if current sessionId belongs to a meta-context, select the meta-context option. On onChange: if value starts with mc:, resolve to the last sessionId in that meta-context's sessionIds and call onSwitch. Add metaContexts to SessionPicker props and pass from Chat. Add group header styles."
  },
  {
    "id": "T-4",
    "name": "next_block_click command handler and client wiring",
    "ucs": ["UC-1", "UC-2"],
    "depends": ["T-0", "T-1"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": [
        "server/index.ts",
        "client/index.tsx"
      ]
    },
    "description": "Add next_block_click case in server/index.ts WebSocket message switch. Handler: (a) look up meta-context by name in registry nameIndex, (b) if not found create UUID and emit MetaContextCreated, (c) create new ACP session via bridge.createSession(), (d) emit SessionCreated, (e) emit SessionAddedToMetaContext, (f) send SessionSwitched to client, subscribe WS to new session, replay, (g) emit PromptSubmitted and call bridge.submitPrompt. If meta-context exists, skip (b). In client/index.tsx: add handleNextBlockClick callback that sends { command: 'next_block_click', label, commandText, metaContext } over WS. Pass through Chat → MessageList → MarkdownText as onNextBlockClick prop."
  }
]
```

## Wave 0 (parallel)

### T-0: Server types, slices, and meta-context projection
- **UCs**: UC-8 (+ New Types foundation)
- **Files**: create `server/slices/meta-context-created.ts`, `server/slices/session-added-to-meta-context.ts`, `server/slices/meta-context-index.ts`, `server/projections/meta-context-registry.ts`; modify `server/types.ts`, `server/server-state.ts`, `server/projections/session-list.ts`, `server/index.ts`, `client/types.ts`
- **Summary**: Establish all shared type definitions and the server-side meta-context infrastructure. This is the data foundation that UC-5/6 (picker) and UC-1/2 (command handler) build on.
- **Steps**:
  1. In `server/types.ts`: add `MetaContextCreated` and `SessionAddedToMetaContext` event types (with `BaseEvent & { type: "..."; ... }` pattern). Add both to the `SessionEvent` union. Add `NextBlockClickCommand` to the `Command` union. Add `MetaContextInfo` type. Add `metaContexts: MetaContextInfo[]` field to `SessionListEvent`.
  2. In `server/server-state.ts`: add `MetaContextMeta` type (`{ id, name, sessionIds[] }`), `MetaContextRegistryState` type (`{ contexts: Map, nameIndex: Map }`), and `initialMetaContextRegistryState` export.
  3. Create `server/slices/meta-context-created.ts`: reducer `(MetaContextRegistryState, DomainEvent) => MetaContextRegistryState`. If event type is `MetaContextCreated`, add entry to `contexts` map and `nameIndex`. Otherwise return state unchanged.
  4. Create `server/slices/session-added-to-meta-context.ts`: if event type is `SessionAddedToMetaContext`, append `sessionId` to the context's `sessionIds` array.
  5. Create `server/slices/meta-context-index.ts`: combine the two slices into `metaContextRegistryReducer`, same pattern as `server/slices/index.ts` for session registry.
  6. Create `server/projections/meta-context-registry.ts`: custom projection (not using generic `Projection` class). Hydrates from `.conclave/state/meta-contexts.json` on construction. Subscribes to EventStore. On each relevant event, updates in-memory state via reducer and writes through to JSON file. Export `createMetaContextRegistry(store, cwd)` returning `{ getState() }`.
  7. Extend `buildSessionList()` in `server/projections/session-list.ts` to accept the meta-context registry and include `metaContexts` array in the `SessionListEvent`. Add `MetaContextCreated` and `SessionAddedToMetaContext` to `SESSION_AFFECTING_EVENTS`.
  8. In `server/index.ts`: create the meta-context registry after the EventStore. Pass it to `buildSessionList()` calls and `createSessionListProjection`.
  9. In `client/types.ts`: add `MetaContextInfo` type, add `metaContexts: MetaContextInfo[]` to `AppState`, set initial value to `[]`.
- **Tests**:
  - `server/slices/meta-context-created.test.ts` — creates entry in state from event, ignores unrelated events.
  - `server/slices/session-added-to-meta-context.test.ts` — appends session ID to existing context, ignores unrelated events.
  - `server/projections/meta-context-registry.test.ts` — hydrates from JSON, processes events, writes through.

### T-1: Render conclave:next block as button with warning
- **UCs**: UC-4, UC-9
- **Files**: create `.claude/skills/conclave/references/next.md`, `client/components/next-block-button.tsx`; modify `client/components/markdown-text.tsx`, `client/style.css`
- **Summary**: Client-side rendering of `conclave:next` fenced code blocks as clickable buttons. No server dependency — purely UI rendering.
- **Steps**:
  1. Create `.claude/skills/conclave/references/next.md` defining the block schema: `{ label: string, command: string, metaContext: string }`. Document that `metaContext` is required and blocks without it render a warning.
  2. Create `client/components/next-block-button.tsx` exporting `NextBlockButton({ label, command, metaContext, onRun, disabled })`. Renders a styled button showing the `label` text. When clicked, calls `onRun({ label, command, metaContext })`. Accepts a `disabled` prop to grey out the button.
  3. In `client/components/markdown-text.tsx`, add a `conclave:next` branch in the `components.pre` handler (same pattern as `conclave:usecase` and `conclave:eventmodel`). Parse the JSON, validate it has `label` and `command` fields. If valid and has `metaContext`, render `<NextBlockButton>`. If missing `metaContext`, render a warning message (muted-text span saying "Next block missing metaContext"). If invalid JSON, fall through to normal code block.
  4. The `onRun` callback must be threaded from the App root so it can send the WS command. `MarkdownText` needs a new optional prop `onNextBlockClick`. Pass it down through `MessageList` → `MarkdownText`.
  5. Add CSS for `.next-block-btn` in `client/style.css`: accent-colored button, hover/active states, disabled state (greyed out, `pointer-events: none`).
- **Tests**:
  - `client/components/next-block-button.test.ts` — renders with label text, calls onRun on click, does not call onRun when disabled. Block without `metaContext` does not render a button.

## Wave 1 (after wave 0)

### T-2: Disable next-block buttons for past and clicked states
- **Depends on**: T-1
- **UCs**: UC-3
- **Files**: modify `client/components/next-block-button.tsx`, `client/components/markdown-text.tsx`
- **Summary**: Prevent duplicate or stale session creation by disabling buttons after click and during replay. Builds directly on T-1's button component.
- **Steps**:
  1. In `NextBlockButton`, add local `useState(false)` for `clicked`. On click, set `clicked = true` before calling `onRun`. When `clicked` is true, render as disabled.
  2. `MarkdownText` receives an `isReplay` prop (boolean). When `isReplay` is true, all `conclave:next` buttons render as disabled. `MessageList` sets `isReplay` per message: messages that aren't the last assistant message while streaming pass `isReplay={true}`. When `isProcessing` is false, all buttons are disabled. Simplest heuristic: always disable buttons in non-streaming messages, and let the `clicked` state handle the live message.
  3. Since messages from replayed sessions (after `SessionSwitched`) are always in `state.messages` (not streaming), all their buttons are automatically disabled by the isReplay logic.
- **Tests**:
  - Button disables after click (local state).
  - Buttons in replayed messages render disabled.

### T-3: Grouped session picker and meta-context switching
- **Depends on**: T-0
- **UCs**: UC-5, UC-6
- **Files**: create `client/components/session-picker.test.ts`; modify `client/slices/session-list.ts`, `client/slices/session-switched.ts`, `client/components/session-picker.tsx`, `client/components/chat.tsx`
- **Summary**: Display meta-contexts as grouped entries in the session picker and resolve selection to the most recent session. Depends on T-0 for the `metaContexts` data in AppState and server broadcasts.
- **Steps**:
  1. Update `client/slices/session-list.ts` to also store `event.metaContexts ?? []` into `state.metaContexts`.
  2. In `client/slices/session-switched.ts`, add `metaContexts: state.metaContexts` to the reset object (same pattern as `sessions`, `specs`, `gitFiles`).
  3. Refactor `SessionPicker` to use react-select's `GroupedOptionsType`. Build two groups:
     - **"Specs"** group: one option per meta-context, with `value` = meta-context id (prefixed `mc:` to distinguish from session IDs), `label` = meta-context name.
     - **"Sessions"** group: standalone sessions (those whose `sessionId` does not appear in any meta-context's `sessionIds`). Same label logic as today.
  4. Update `currentValue` derivation: if the current `sessionId` belongs to a meta-context, select the meta-context option. Otherwise select the session option.
  5. Update `onChange`: if the selected value starts with `mc:`, resolve to the last `sessionId` in that meta-context's `sessionIds` array and call `onSwitch(resolvedSessionId)`. Otherwise call `onSwitch(value)` as before.
  6. Add `metaContexts` to the `SessionPicker` props and pass it from `Chat`.
  7. Add group header styles to the react-select `styles` config.
- **Tests**:
  - `client/components/session-picker.test.ts` — renders grouped options, resolves meta-context selection to most recent session ID.
  - `client/slices/session-switched.test.ts` — verify `metaContexts` is preserved after SessionSwitched.

### T-4: next_block_click command handler and client wiring
- **Depends on**: T-0, T-1
- **UCs**: UC-1, UC-2
- **Files**: modify `server/index.ts`, `client/index.tsx`
- **Summary**: The write-side command handler that creates/reuses meta-contexts and sessions on button click, plus the client callback wiring. Depends on T-0 for the meta-context registry projection and T-1 for the button's `onRun` callback interface.
- **Steps**:
  1. In `server/index.ts`, add a `case "next_block_click"` handler in the WebSocket message switch:
     a. Read `cmd.metaContext` (the name), `cmd.commandText` (the prompt), `cmd.label`.
     b. Look up the meta-context by name in the meta-context registry's `nameIndex`.
     c. If not found: generate a new `metaContextId` (e.g. `crypto.randomUUID()`), emit `MetaContextCreated` event (use the ws client's current session ID as the event's sessionId).
     d. Create a new ACP session via `bridge.createSession()`.
     e. Emit `SessionCreated` for the new session.
     f. Emit `SessionAddedToMetaContext` with the `metaContextId` and new `sessionId`.
     g. Send `SessionSwitched` to the clicking client, subscribe WS to the new session, replay.
     h. Submit the prompt: `store.append(newSessionId, { type: "PromptSubmitted", text: cmd.commandText })` then `bridge.submitPrompt(newSessionId, cmd.commandText, undefined, true)`.
  2. If the meta-context already exists (UC-2), skip step (c) and use the existing `metaContextId` for step (f). All other steps are identical.
  3. In `client/index.tsx`, add a `handleNextBlockClick` callback that sends `{ command: "next_block_click", label, commandText, metaContext }` over WebSocket. Pass it through to `Chat` → `MessageList` → `MarkdownText` as the `onNextBlockClick` prop.
- **Tests**:
  - `server/index.ts` integration test (or focused handler test): next_block_click with new meta-context creates MetaContextCreated + SessionCreated + SessionAddedToMetaContext events.
  - Same command with existing meta-context name skips MetaContextCreated, still emits SessionAddedToMetaContext.
