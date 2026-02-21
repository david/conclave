---
name: arq
description: Translate a spec's analysis.md (containing structured use cases) into a concrete implementation.md plan. Use when a user wants to architect or plan the implementation of a spec, such as "architect this spec", "create implementation plan for...", "translate analysis to implementation", "/arq <spec-name>", or when a spec has an analysis.md and needs the next phase. Reads the analysis use cases and the project's CLAUDE.md to produce file-level implementation steps mapped to each use case.
---

# Architect

Translate structured requirements (analysis.md) into a concrete implementation plan (implementation.md).

## Workflow

### 1. Locate the Spec

Resolve the spec name from the user's request. The spec directory is `.conclave/specs/<spec-name>/`.

- Read `.conclave/specs/<spec-name>/analysis.md` — this contains the use cases.
- Read `.conclave/specs/<spec-name>/spec.json` if it exists — for description, type, and epic context.
- If the spec name is ambiguous or missing, list `.conclave/specs/` and ask.

### 2. Load Project Context

Read `CLAUDE.md` at the project root. This describes the architecture, file layout, conventions, and data flow. The implementation plan must respect whatever architecture the project uses.

Read key files referenced in CLAUDE.md (types, entry points, existing slices) to understand current patterns. Reference specific existing files as anchors for where new code fits.

### 3. Parse Use Cases

Extract all `conclave:usecase` blocks from analysis.md. For each use case, note:
- **id** and **dependencies** — determines implementation order
- **actor** — System use cases are backend; End User use cases touch UI
- **given/when/then** — maps to preconditions, handlers, and assertions

### 4. Produce the Implementation Plan

Write `.conclave/specs/<spec-name>/implementation.md`.

#### Structure

```markdown
# <Spec Name> — Implementation

<One-paragraph summary of what will be built and the overall approach.>

## New Types

<Any new TypeScript types, interfaces, event types, or state shapes needed across multiple use cases. Define once here rather than repeating per use case.>

## <UC-X: Use Case Name>

**Files:**
- `path/to/file.ts` — what to create or modify and why

**Steps:**
1. Concrete implementation step (function name, type to add, event to emit, etc.)
2. ...

**Tests:**
- Description of test scenario → expected outcome
```

#### Guidelines

- **Group related use cases** when they touch the same files and are cleaner to implement together. Use a combined heading like `## UC-1 + UC-2: Scan and Phase Detection`. Preserve all UC IDs in the heading.
- **Respect dependency order.** Use cases with no dependencies come first. A use case that depends on UC-1 appears after UC-1's section.
- **Be concrete.** Name specific files, functions, types, and event names. "Add a handler" is too vague; "Add `handleSpecScan()` in `server/specs.ts`" is right.
- **Reference existing patterns.** If the project uses slices, projections, or specific conventions, mirror them. Don't invent new architectural patterns.
- **New Types section.** Pull shared types (events, state shapes, DTOs) into a dedicated section at the top so use case sections can reference them without repetition.
- **Test scenarios.** Each use case gets at least one test scenario. Describe what to test and the expected outcome. Follow the project's existing test conventions (co-located `*.test.ts` files, Bun test runner, etc.).
- **Keep it buildable.** Each section should be implementable as a PR or commit. Avoid forward references to code that doesn't exist yet and isn't defined in an earlier section.
- **No implementation leakage into analysis.** The implementation plan complements analysis.md — don't duplicate the requirements prose. Reference use case IDs rather than restating given/when/then.
- **Calibrate depth.** A 3-use-case spec needs a short plan. A 10-use-case spec needs more structure. Match effort to scope.

### 5. Confirm with User

After writing implementation.md, summarize what was produced and offer to:
- Adjust groupings or ordering
- Add more detail to specific sections
- Begin implementation of the first use case group
