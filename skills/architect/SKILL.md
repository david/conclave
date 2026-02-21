---
name: arq
description: >
  Model the event architecture for a spec's use cases. Reads analysis.md (use cases) and the
  existing codebase (types, slices, projections) to augment analysis.md with event model
  sections — mapping each use case to commands, domain events, projections, and side effects.
  Use when a spec has an analysis.md and needs event modeling before implementation planning.
  Triggers on: "architect this spec", "model events for...", "event model for...", "/arq",
  "/arq <spec-name>", or when a spec has an analysis.md and the user wants to design the
  event flows.
---

# Architect

Model the event architecture for each use case — commands, domain events, projections, and side effects.

## Workflow

### 1. Locate the Spec

Resolve the spec name. Read `.conclave/specs/<spec-name>/analysis.md` and `spec.json`. If ambiguous, list `.conclave/specs/` and ask.

### 2. Load Codebase Architecture

Read `CLAUDE.md`, then read the key architectural files:

- `server/types.ts` — `DomainEvent` union, `Command` union, `EventPayload`
- `server/slices/` — existing command→event patterns
- `server/projections/` — existing read models
- `server/index.ts` — command handlers, WebSocket relay
- `client/types.ts` and `client/slices/` — client-side state and reducers

Note which events, commands, projections, and state shapes already exist.

### 3. Model Events Per Use Case

For each use case (or group of related use cases), determine:

- **Command** — what triggers the flow
- **Domain events** — what facts are recorded in the EventStore
- **Projections** — what derived state changes (new or existing read models)
- **Side effects** — WS broadcasts, ACP calls, client slice updates

### 4. Augment analysis.md

Add an `#### Event Model` subsection under each use case heading in analysis.md. Do not alter existing use case content (Actor, Summary, Given/When/Then) — append the event model below it.

#### Format

```markdown
### UC-1: <Name> (<Priority>)
- **Actor:** <actor>
- **Summary:** ...
- **Given:** ...
- **When:** ...
- **Then:** ...

#### Event Model
**Command:** `command_name` — <trigger description>
- field: type

**Events:**
- `EventName` (new/existing) — <what fact this records>
  - field: type

**Projections:**
- `ProjectionName` (new/existing) — <what state it derives>
  - State shape: `{ field: type }`
  - Handles: `EventName` → <state transition>

**Side Effects:**
- WS broadcast: <what clients receive>
- Client slice: `sliceName` handles `EventName` → <state change>
- ACP: <subprocess interaction, if any>
```

If use cases share the same event flow and were grouped by the analyst, add one event model section for the group.

#### Guidelines

- **Flag new vs existing** for every event, command, and projection.
- **Name concretely.** Use actual TypeScript type names and field names. `SpecScanned` not "a scan event".
- **Follow existing conventions.** Events extend `BaseEvent` or `BaseGlobalEvent`. Commands use `{ command: string }`. Projections extend `Projection<S>`.
- **Keep it architectural.** Focus on *what data flows where*, not file paths or function names — that's the planner's job.
- **Calibrate depth.** Match effort to scope.

### 5. Confirm with User

Summarize new event types, new projections, and existing infrastructure being extended. Offer to adjust, then provide the next step:

```
/plan <spec-name>
```
