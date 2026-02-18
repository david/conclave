# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Conclave is a full-stack TypeScript/React chat interface that bridges to Claude Code via the Agent Client Protocol (ACP). It uses an event-sourced architecture where all state changes flow through an in-memory EventStore and are streamed to the browser over WebSocket.

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
- **index.ts** — Bun HTTP + WebSocket server on port 3000. Serves static files from `dist/`, replays all events on WebSocket connect, routes commands to the bridge.
- **acp-bridge.ts** — Spawns `claude-code-acp` as a subprocess, manages the ACP session lifecycle, translates ACP updates to domain events, handles file I/O. Working directory: `CONCLAVE_CWD` env var or `cwd()`.
- **event-store.ts** — Append-only in-memory event log with monotonic sequence numbering and pub/sub for listeners.
- **acp-translate.ts** — Pure function mapping ACP `SessionUpdate` objects to domain events.
- **types.ts** — Discriminated union types for all domain events and commands.

### Client (`client/`)
- **index.tsx** — App root. Manages WebSocket connection with auto-reconnect, dispatches events to the reducer.
- **reducer.ts** — `useReducer`-based state management. Accumulates streaming `AgentText` chunks and flushes on `TurnCompleted`.
- **components/** — `chat.tsx` (main container), `message-list.tsx` (message rendering with auto-scroll), `input-bar.tsx` (textarea with Shift+Enter), `tool-call.tsx` (collapsible tool call cards).
- **style.css** — Dark theme with CSS variables, BEM-style class naming (`.component__element--modifier`).

### Domain Events
All events carry `seq` (monotonic) and `timestamp`. Types: `SessionCreated`, `PromptSubmitted`, `AgentText`, `ToolCallStarted`, `ToolCallUpdated`, `ToolCallCompleted`, `TurnCompleted`, `Error`.

### Commands (browser to server)
`submit_prompt` (with text) and `cancel`, sent as JSON over WebSocket.

## Key Conventions

- **Runtime/bundler**: Bun exclusively (no Node, no npm/yarn)
- **TypeScript strict mode** with discriminated unions for type-safe event handling
- **`DistributiveOmit`** utility type in `types.ts` preserves union members when stripping `seq`/`timestamp` to create `EventPayload`
- **Tests** live alongside source files (`*.test.ts`), use `describe`/`test`/`expect` from Bun's test runner
- **No linting/formatting tools** configured — follow existing code style
