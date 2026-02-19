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
Claude Code ACP subprocess → AcpBridge → EventStore → WebSocket → React client
```

### Server (`server/`)
- **index.ts** — Bun HTTP + WebSocket server on port 3000. Serves static files from `dist/`, replays events per session on WebSocket connect, routes commands to the bridge. Manages multi-session state: tracks session metadata (title, first prompt), broadcasts session lists, and handles session switching/loading.
- **acp-bridge.ts** — Spawns `claude-code-acp` as a subprocess, manages the ACP session lifecycle (create, load, list, prompt, cancel, set mode), translates ACP updates to domain events, handles file I/O and permission requests. Auto-approves regular tool permissions; defers plan approval (ExitPlanMode) to the UI. Reads plan file content for the approval dialog.
- **event-store.ts** — Append-only in-memory event log with monotonic sequence numbering, per-session filtering, and pub/sub for listeners.
- **acp-translate.ts** — Pure function mapping ACP `SessionUpdate` objects to domain events. Handles `agent_message_chunk`, `tool_call`, `tool_call_update`, `user_message_chunk` (replay only), `plan`, and `current_mode_update`.
- **types.ts** — Discriminated union types for all domain events and commands.

### Client (`client/`)
- **index.tsx** — App root. Manages WebSocket connection with auto-reconnect, dispatches events to the reducer. Renders two-pane layout: `Workspace` (left) and `Chat` (right). Sends commands: `submit_prompt`, `cancel`, `create_session`, `switch_session`, `permission_response`.
- **types.ts** — Shared client types (`AppState`, `ClientEvent`, `ContentBlock`, `Message`, etc.) and `initialState`. Breaks the circular dependency between `reducer.ts` and slices.
- **reducer.ts** — Thin facade over slice reducers. Exports `applyEvent`, `fold`, and `useEventStore` hook. Re-exports all types from `types.ts` so consumers don't need to change imports.
- **slices/** — Composable slice reducers, each owning a subset of `AppState`. Signature: `(sliceState, event, fullState?) → sliceState`. Combined in `slices/index.ts`.
  - `sessions.ts` — `sessionId`, `sessions`, `creatingSession`
  - `messages.ts` — `messages`, `streamingContent`, `isProcessing` (reads `fullState.currentMode` for plan-mode tool call suppression)
  - `plan.ts` — `currentMode`, `planContent`, `planEntries`
  - `permissions.ts` — `pendingPermission`
  - `usage.ts` — `usage`
  - `error.ts` — `error`
- **components/**:
  - `chat.tsx` — Main chat container with header (session picker + new session button), error display, message list, and input bar.
  - `message-list.tsx` — Renders messages with auto-scroll. Groups consecutive tool calls into `ToolCallGroup` segments. Shows markdown for assistant text, plain text for user messages. Includes empty state, streaming indicator, and thinking dots.
  - `input-bar.tsx` — Textarea with Enter to send, Shift+Enter for newline. Shows cancel button (stop icon) during processing, send button otherwise.
  - `session-picker.tsx` — `react-select` `CreatableSelect` dropdown for switching between sessions or creating new ones. Displays session title or first prompt as label.
  - `tool-call.tsx` — Collapsible card showing tool name, status icon, kind badge, and expandable input/output details.
  - `tool-call-group.tsx` — Groups multiple consecutive tool calls into a single collapsible summary row showing count and last tool status.
  - `markdown-text.tsx` — Renders markdown with `react-markdown`, `remark-gfm`, and `rehype-highlight` for syntax highlighting.
  - `workspace.tsx` — Left sidebar (workspace pane) that can hold different content types. Currently shows plan content (rendered as markdown), task entries with status icons, and permission approval buttons. Includes feedback textarea for plan rejection.
- **style.css** — Dark theme with CSS variables, BEM-style class naming (`.component__element--modifier`).

### Domain Events
All events carry `seq` (monotonic), `timestamp`, and `sessionId`. Types: `SessionCreated`, `PromptSubmitted`, `AgentText`, `ToolCallStarted`, `ToolCallUpdated`, `ToolCallCompleted`, `TurnCompleted`, `PlanUpdated`, `ModeChanged`, `PermissionRequested`, `Error`, `SessionSwitched`.

The `SessionListEvent` is a meta-event sent over WebSocket (not stored in EventStore) with `seq: -1`.

### Commands (browser to server)
`submit_prompt`, `cancel`, `create_session`, `switch_session`, and `permission_response` — sent as JSON over WebSocket.

## Key Conventions

- **Runtime/bundler**: Bun exclusively (no Node, no npm/yarn)
- **TypeScript strict mode** with discriminated unions for type-safe event handling
- **`DistributiveOmit`** utility type in `types.ts` preserves union members when stripping `seq`/`timestamp`/`sessionId` to create `EventPayload`
- **Tests** live alongside source files (`*.test.ts`), use `describe`/`test`/`expect` from Bun's test runner
- **No linting/formatting tools** configured — follow existing code style
- **Multi-session support**: Server discovers existing ACP sessions on startup, creates a fresh one, and supports switching/loading on demand
- **Markdown rendering**: Assistant messages use `react-markdown` with GFM and syntax highlighting via `rehype-highlight`
