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

**Epic resolution:** If `spec.json` contains an `"epic"` field, read the epic's `analysis.md` at `.conclave/specs/<epic>/analysis.md` first. The epic's analysis contains shared decisions, schemas, and constraints that apply to all child specs. Load this context before modeling events for the child spec's use cases.

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

Add an `## Event Model` section after the use cases in analysis.md. Do not alter existing use case content. Emit one `conclave:eventmodel` fenced code block per slice, both in chat and in analysis.md.

#### Format

Read `skills/conclave/references/eventmodel.md` for the full schema, field definitions, rendering behavior, and examples before emitting blocks.

Emit one `conclave:eventmodel` fenced code block per slice. If grouped use cases share the same event flow, emit one slice for the group.

#### Guidelines

- **Flag new vs existing** via the `new` boolean on commands, events, and projections.
- **Name concretely.** Use actual TypeScript type names (`PromptSubmitted`, not "a prompt event") but don't specify file paths or function signatures — that's the planner's job.
- **Follow existing conventions.** Events extend `BaseEvent` or `BaseGlobalEvent`. Commands use `{ command: string }`. Projections extend `Projection<S>`.
- **Calibrate depth.** Match effort to scope.

### 5. Confirm with User

Summarize new event types, new projections, and existing infrastructure being extended. Offer to adjust.

When you're ready for the next phase, read `skills/conclave/references/next.md` for the schema, then emit a `conclave:next` fenced code block:

````
```conclave:next
{"label":"Review Architecture","command":"/review arq <spec-name>","metaContext":"<spec-name>"}
```
````

Replace `<spec-name>` with the resolved spec directory name.
