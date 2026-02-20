# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Conclave is a full-stack TypeScript/React chat interface that bridges to Claude Code via the Agent Client Protocol (ACP). It uses an event-sourced architecture where all state changes flow through an in-memory EventStore and are streamed to the browser over WebSocket. The UI features a two-pane layout: a workspace (left) and a chat pane (right).

## Commands

```bash
bun test                    # Run all tests (Bun native test runner)
bun test server/            # Run server tests only
bun test client/            # Run client tests only
bun run check               # TypeScript type checking (tsc --noEmit)
bun run build               # Bundle client to dist/
bun run build:watch         # Bundle client in watch mode
bun run dev                 # Start the server (port 3000)
```

For full development (build watch + server), use `process-compose up` which orchestrates both processes via `process-compose.yml`.

## Architecture

**Data flow:**
```
Command → index.ts (write side) → store.append(event)
                                        ↓
                              store notifies subscribers
                                 ↓              ↓
                          Read models        WS relay to clients
                          (projections)

Claude Code ACP subprocess → AcpBridge → EventStore → Projections + WebSocket
```

### Server (`server/`)

The server uses event sourcing with separated write and read models. Commands emit events into the EventStore (write side). Projections subscribe to events and maintain derived read models. Each slice encapsulates a single command→event path and its projection into shared state.

- **index.ts** — Bun HTTP + WebSocket server on port 3000. Serves static files from `dist/`, replays events per session on WebSocket connect. Acts as the write side: command handlers validate against read models, then emit events into the store.
- **acp-bridge.ts** — Spawns `claude-code-acp` as a subprocess, manages the ACP session lifecycle (create, load, list, prompt, cancel), translates ACP updates to domain events, handles file I/O and permission requests. Auto-approves all permission requests. Injects `_meta.systemPrompt.append` (mode system prompt) and `_meta.claudeCode.options.disallowedTools` (disabling `EnterPlanMode`/`ExitPlanMode`) at session creation.
- **mode-loader.ts** — Scans `~/.conclave/modes/` (global) and `<cwd>/.conclave/modes/` (project) for `.md` files with YAML frontmatter. Parses mode definitions (label, color, icon, placeholder, order, instruction). Project modes override global. Built-in `chat` mode is always present. Exports `loadModes()` and `buildModeSystemPrompt()`.
- **event-store.ts** — Append-only in-memory event log with monotonic sequence numbering, per-session filtering, and pub/sub for listeners. Stays a dumb log — no derived state.
- **projection.ts** — Generic `Projection<S>` base class. Replays existing events on construction, then subscribes for new ones. Each projection maintains its own derived state via a reducer.
- **server-state.ts** — Server-side domain state types (`SessionMeta`, `SessionRegistryState`, `LatestSessionState`) and initial values.
- **slices/** — Pure reducer functions, one per command→event path. All project into the shared `SessionRegistryState`. Combined sequentially in `slices/index.ts`.
  - `create-session.ts` — `SessionCreated` → adds session (loaded: true), increments counter
  - `discover-session.ts` — `SessionDiscovered` → adds session (loaded: false), increments counter
  - `load-session.ts` — `SessionLoaded` → flips loaded to true
  - `track-first-prompt.ts` — `PromptSubmitted` → sets firstPrompt if not yet set
  - `update-title.ts` — `SessionInfoUpdated` → updates title
- **projections/** — Read models that subscribe to the EventStore and maintain queryable views.
  - `session-registry.ts` — Command-side session lookups (session metadata, loaded state, counter)
  - `latest-session.ts` — Tracks which session new WS connections should get
  - `session-list.ts` — Reactive projection that triggers session list broadcasts on change; derives data from SessionRegistry
- **acp-translate.ts** — Pure function mapping ACP `SessionUpdate` objects to domain events. Handles `agent_message_chunk`, `tool_call`, `tool_call_update`, `user_message_chunk` (replay only), `plan`, and `current_mode_update`.
- **types.ts** — Discriminated union types for all domain events and commands.

### Client (`client/`)
- **index.tsx** — App root. Manages WebSocket connection with auto-reconnect, dispatches events to the reducer. Renders two-pane layout: `Workspace` (left, always visible when session active) and `Chat` (right). Sends commands: `submit_prompt`, `cancel`, `create_session`, `switch_session`, `set_mode`.
- **types.ts** — Shared client types (`AppState`, `ClientEvent`, `ContentBlock`, `Message`, etc.) and `initialState`. Breaks the circular dependency between `reducer.ts` and slices.
- **reducer.ts** — Thin facade over slice reducers. Exports `applyEvent`, `fold`, and `useEventStore` hook. Re-exports all types from `types.ts` so consumers don't need to change imports.
- **mode-config.ts** — Client-side mode helpers: `getModeInfo()` lookup with fallback, `modeColorVar()`/`modeColorDimVar()` for CSS variable mapping.
- **slices/** — Composable slice reducers, each owning a subset of `AppState`. Signature: `(sliceState, event, fullState?) → sliceState`. Combined in `slices/index.ts`.
  - `sessions.ts` — `sessionId`, `sessions`, `creatingSession`
  - `messages.ts` — `messages`, `streamingContent`, `isProcessing` (reads `fullState.currentMode` for plan-mode tool call suppression)
  - `mode-changed.ts` — `currentMode`, `fileChanges` (clears file changes when leaving implement mode)
  - `mode-list.ts` — `availableModes` (handles `ModeList` meta-event from server)
  - `plan-updated.ts` — `planEntries`
  - `usage.ts` — `usage`
  - `error.ts` — `error`
- **components/**:
  - `chat.tsx` — Main chat container with header (session picker + new session button), error display, message list, and input bar.
  - `message-list.tsx` — Renders messages with auto-scroll. Groups consecutive tool calls into `ToolCallGroup` segments. Shows markdown for assistant text, plain text for user messages. Includes empty state, streaming indicator, and thinking dots.
  - `input-bar.tsx` — Textarea with Enter to send, Shift+Enter for newline. Accepts `placeholder` prop (driven by current mode). Shows cancel button (stop icon) during processing, send button otherwise.
  - `session-picker.tsx` — `react-select` `CreatableSelect` dropdown for switching between sessions or creating new ones. Displays session title or first prompt as label.
  - `tool-call.tsx` — Collapsible card showing tool name, status icon, kind badge, and expandable input/output details.
  - `tool-call-group.tsx` — Groups multiple consecutive tool calls into a single collapsible summary row showing count and last tool status.
  - `markdown-text.tsx` — Renders markdown with `react-markdown`, `remark-gfm`, and `rehype-highlight` for syntax highlighting.
  - `workspace.tsx` — Left sidebar (workspace pane). Header contains `ModePicker` and a "Working..." status badge when processing. Content area shows task entries with status icons and file change rows.
  - `mode-picker.tsx` — Segmented button group for switching modes. Renders from `availableModes` (not hardcoded). Single label for 1 mode, button group for multiple. Buttons use `data-color` for CSS active state styling.
- **style.css** — Dark theme with CSS variables, BEM-style class naming (`.component__element--modifier`).

### Domain Events
All events carry `seq` (monotonic), `timestamp`, and `sessionId`. Types: `SessionCreated`, `SessionDiscovered`, `SessionLoaded`, `PromptSubmitted`, `AgentText`, `ToolCallStarted`, `ToolCallUpdated`, `ToolCallCompleted`, `TurnCompleted`, `PlanUpdated`, `ModeChanged`, `PermissionRequested`, `Error`, `SessionSwitched`.

The `SessionListEvent` and `ModeListEvent` are meta-events sent over WebSocket (not stored in EventStore) with `seq: -1`.

### Commands (browser to server)
`submit_prompt`, `cancel`, `create_session`, `switch_session`, and `set_mode` — sent as JSON over WebSocket.

### Multi-Mode System

Conclave replaces Claude Code's built-in plan mode with a customizable multi-mode system. Modes are defined as `.md` files in `.conclave/modes/` directories (global at `~/.conclave/modes/`, project-scoped at `<cwd>/.conclave/modes/`). Each file has YAML frontmatter (`label`, `color`, `icon`, `placeholder`, `order`) and a markdown body containing behavioral instructions.

The built-in `chat` mode is always present (no file required). All other modes are user-defined. Plan mode (`EnterPlanMode`/`ExitPlanMode`) is disabled via `disallowedTools`.

**Mode mechanics:**
- Mode instructions are prepended to user prompts as `[Mode: Label]\n<instruction>\n---\n<user text>`
- `buildModeSystemPrompt()` injects an overview of available modes into the ACP session's system prompt at creation time
- Mode switching is per-WebSocket-connection (stored in `WsState.currentModeId`), emitted as `ModeChanged` events for replay on reconnect
- The workspace header always shows a `ModePicker` for switching modes

## Key Conventions

- **Runtime/bundler**: Bun exclusively (no Node, no npm/yarn)
- **TypeScript strict mode** with discriminated unions for type-safe event handling
- **`DistributiveOmit`** utility type in `types.ts` preserves union members when stripping `seq`/`timestamp`/`sessionId` to create `EventPayload`
- **Tests** live alongside source files (`*.test.ts`), use `describe`/`test`/`expect` from Bun's test runner
- **No linting/formatting tools** configured — follow existing code style
- **Event sourcing**: Server state is derived from events via projections (read models). Each slice handles one command→event path. The EventStore is a dumb log; projections subscribe and maintain views. Write side (command handlers) emits events; read side (projections) derives state.
- **Multi-session support**: Server discovers existing ACP sessions on startup, creates a fresh one, and supports switching/loading on demand
- **Markdown rendering**: Assistant messages use `react-markdown` with GFM and syntax highlighting via `rehype-highlight`
