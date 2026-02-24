---
name: plan
description: Translate a spec's analysis.md (or research.md, for specs without use cases) into a concrete breakdown.md plan. Use when a user wants to plan the implementation of a spec, such as "plan this spec", "create implementation plan for...", "translate analysis to implementation", "/plan <spec-name>", or when a spec has an analysis.md or research.md and needs the next phase.
---

# Planner

Translate structured requirements (analysis.md) or research decisions (research.md) into a concrete breakdown plan (breakdown.md).

The planner supports two input modes:
- **Use-case mode** — when the spec has an `analysis.md` with `conclave:usecase` blocks. Sections are organized by UC ID.
- **Research mode** — when the spec has only a `research.md` (no `analysis.md`). Sections are organized by topic/decision area from the research findings. This is appropriate for specs that are primarily CSS/layout, infrastructure, or configuration work where formal use cases add no value.

## Workflow

### 1. Locate the Spec

Resolve the spec name from the user's request. The spec directory is `.conclave/specs/<spec-name>/`.

- Read `.conclave/specs/<spec-name>/analysis.md` if it exists — this contains the use cases and, if the architect has run, event model sections (commands, events, projections, side effects) under each use case.
- If no `analysis.md` exists, read `.conclave/specs/<spec-name>/research.md` instead — this activates **research mode**.
- If neither `analysis.md` nor `research.md` exists, stop and tell the user. Suggest `/research <spec-name>` to explore the problem space first.
- Read `.conclave/specs/<spec-name>/spec.json` if it exists — for description, type, and epic context.
- **Epic resolution:** If `spec.json` contains an `"epic"` field, read the epic's `analysis.md` at `.conclave/specs/<epic>/analysis.md` first. If the epic has no `analysis.md`, try its `research.md`. The epic's analysis or research contains shared decisions, schemas, and constraints that apply to all child specs. Load this context before planning the child spec's implementation.
- If the spec name is ambiguous or missing, list `.conclave/specs/` and ask.

### 2. Load Project Context

Read `CLAUDE.md` at the project root. This describes the architecture, file layout, conventions, and data flow. The implementation plan must respect whatever architecture the project uses.

Read key files referenced in CLAUDE.md (types, entry points, existing slices) to understand current patterns. Reference specific existing files as anchors for where new code fits.

### 3. Parse the Input

#### Use-case mode (analysis.md)

Read `skills/conclave/references/usecase.md` and `skills/conclave/references/eventmodel.md` to understand the block schemas before parsing.

Extract all `conclave:usecase` blocks from analysis.md. For each use case, note:
- **id** and **dependencies** — determines implementation order
- **actor** — System use cases are backend; End User use cases touch UI
- **given/when/then** — maps to preconditions, handlers, and assertions

Extract all `conclave:eventmodel` blocks from analysis.md (if present). For each slice, note:
- **command** — maps to a command handler and command type
- **events** — map to event types and slice reducers
- **projections** — map to read model classes and state types
- **sideEffects** — map to WS broadcasts, ACP calls, or client slice updates
- **feeds** — cross-slice connections inform integration points and test boundaries

#### Research mode (research.md)

Extract the decisions/findings from the research document. For each decision area, note:
- **Topic** — the heading or subject (e.g., "Navigation," "Viewport & Layout," "PWA")
- **What changes** — concrete modifications described in the decision
- **Codebase references** — any file paths, line numbers, or component names cited
- **Dependencies between topics** — which decisions must be implemented before others (e.g., breakpoint infrastructure before component-specific mobile styles)

### 4. Produce the Implementation Plan

Write `.conclave/specs/<spec-name>/breakdown.md`.

#### Structure

```markdown
# <Spec Name> — Implementation

<One-paragraph summary of what will be built and the overall approach.>

## New Types

<Any new TypeScript types, interfaces, event types, or state shapes needed across multiple sections. Define once here rather than repeating per section. In research mode, omit this section entirely if no shared types are needed.>

## <Section Heading>

**Files:**
- `path/to/file.ts` — what to create or modify and why

**Steps:**
1. Concrete implementation step (function name, type to add, event to emit, etc.)
2. ...

**Tests:**
- Description of test scenario → expected outcome
```

Section headings differ by mode:
- **Use-case mode:** `## UC-X: Use Case Name` (e.g., `## UC-1: Create Session`)
- **Research mode:** `## <Topic Name>` derived from research decisions (e.g., `## Bottom Tab Bar Navigation`, `## Viewport & Keyboard Handling`)

#### Guidelines

- **Group related use cases** (use-case mode) when they touch the same files and are cleaner to implement together. Use a combined heading like `## UC-1 + UC-2: Scan and Phase Detection`. Preserve all UC IDs in the heading.
- **Group related decisions** (research mode) when they touch the same files. For example, tap target sizing and touch feedback may both modify the same CSS file and belong in one section.
- **Respect dependency order.** Use cases or topics with no dependencies come first. A section that depends on an earlier one appears after it.
- **Be concrete.** Name specific files, functions, types, and event names. "Add a handler" is too vague; "Add `handleSpecScan()` in `server/specs.ts`" is right.
- **Reference existing patterns.** If the project uses slices, projections, or specific conventions, mirror them. Don't invent new architectural patterns.
- **New Types section.** Pull shared types (events, state shapes, DTOs) into a dedicated section at the top so later sections can reference them without repetition. In research mode, omit this section if there are no shared types.
- **Test scenarios.** Each section gets at least one test scenario. Describe what to test and the expected outcome. Follow the project's existing test conventions (co-located `*.test.ts` files, Bun test runner, etc.).
- **Keep it buildable.** Each section should be implementable as a PR or commit. Avoid forward references to code that doesn't exist yet and isn't defined in an earlier section.
- **No implementation leakage into source docs.** The implementation plan complements analysis.md or research.md — don't duplicate the requirements prose or research decisions. Reference UC IDs or topic names rather than restating content.
- **Calibrate depth.** A 3-section spec needs a concise plan. A 10-section spec needs more structure. Match effort to scope.

### 5. Confirm with User

After writing breakdown.md, summarize what was produced and offer to:
- Adjust groupings or ordering
- Add more detail to specific sections

When you're ready for the next phase, read `skills/conclave/references/next.md` for the schema, then emit a `conclave:next` fenced code block:

````
```conclave:next
{"label":"Review Plan","command":"/review plan <spec-name>","metaContext":"<spec-name>"}
```
````

Replace `<spec-name>` with the resolved spec directory name.
