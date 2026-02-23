---
name: org
description: >
  Analyze a spec's implementation.md and produce a parallelization-aware task plan (tasks.md).
  Reads UC sections, analyzes dependency chains and file mutation overlaps, determines which
  tasks can run in parallel vs sequentially, and assigns appropriate granularity. Use when
  a spec has an implementation.md and needs task decomposition before orchestrated execution.
  Triggers on: "organize tasks for...", "plan tasks for...", "decompose into tasks", "/org",
  "/org <spec-name>", or when preparing a spec for parallel agent execution.
---

# Organizer

Analyze an implementation plan and produce a parallelization-aware task graph.

## Purpose

Bridge between the planner's `implementation.md` and the orchestrator's parallel execution. The organizer determines **what can run concurrently** and **what must be sequential** by analyzing dependency declarations and file mutation overlaps.

## Workflow

### 1. Locate the Spec

Resolve the spec name from the user's request. Read `.conclave/specs/<spec-name>/implementation.md`.

If missing or ambiguous, list `.conclave/specs/` and ask.

### 2. Parse UC Sections

Extract all `## UC-X: ...` sections (including combined headings like `## UC-1 + UC-2: ...`). For each section, collect:

- **UC IDs**: All UC identifiers in the heading (e.g., `UC-1 + UC-2` → `["UC-1", "UC-2"]`)
- **Files**: Each file path and its operation (**create** vs **modify**)
- **Steps**: The implementation steps
- **Tests**: The test scenarios
- **Dependencies**: Explicit from the analysis.md `dependencies` field, plus implicit from section ordering in implementation.md (the planner respects dependency order)

Also check for a `## New Types` section — this is always a prerequisite for everything else.

### 3. Build the Dependency Graph

For each UC section, determine what it depends on:

1. **Explicit dependencies**: From the original analysis.md UC definitions (`dependencies` field).
2. **File mutation conflicts**: Two sections that both **modify** the same file cannot safely run in parallel. If section A appears before section B and both modify `server/index.ts`, B depends on A.
3. **New Types dependency**: If a `## New Types` section exists, all other sections depend on it (shared type definitions must exist first).
4. **Create-then-modify**: If section A **creates** a file and section B **modifies** or imports from it, B depends on A.

Read `.conclave/specs/<spec-name>/analysis.md` to cross-reference explicit UC dependencies.

### 4. Determine Task Granularity

Each UC section from implementation.md becomes one task by default. Adjust when:

- **Split** a UC section if it contains clearly independent substeps touching different files with no data flow between them, AND splitting would enable more parallelism. Don't split just for granularity's sake.
- **Merge** UC sections that are trivially small (e.g., "no code changes needed") into a parent task or mark as no-op.
- **Convention tasks**: UC sections that describe skill conventions or documentation-only changes (no code) should be marked as `kind: "convention"` — the orchestrator can skip these or handle them differently.

### 5. Enforce TDD Task Ordering (Red-Green)

Every code task that has associated tests must follow strict TDD ordering:

1. **Tests come first.** The test task is always in an earlier wave than the implementation task it validates. Never place tests after or in the same wave as the code they cover.
2. **Red must be meaningful.** The test task must fail against the *current* codebase for the right reason — the actual bug or missing behavior — not because a function doesn't exist or a file can't be imported. If the tests would fail for a structural reason (e.g., importing a file that doesn't exist yet), the task that creates that structural prerequisite goes in an earlier wave.
3. **Green is the implementation.** The implementation task's description must explicitly state "run the T-N tests — all must pass green" as its final step.
4. **Name tasks with phase prefixes** when the red-green cycle is the primary structure: `"Red: <what the tests cover>"`, `"Green: <what the fix/feature does>"`.

Example wave assignment for a bug fix:
- **Wave 0**: `T-0: Red — tests that reproduce the bug` (fail with meaningful assertion like "expected 10 events, received 0")
- **Wave 1**: `T-1: Green — apply the fix` (tests pass)

For new features with types + tests + implementation:
- **Wave 0**: `T-0: New types` (structural prerequisite)
- **Wave 1**: `T-1: Red — tests for UC-1` (imports types, fails because behavior is missing)
- **Wave 2**: `T-2: Green — implement UC-1` (tests pass)

If multiple UCs have independent test+implementation pairs, their red tasks can share a wave and their green tasks can share a later wave.

### 6. Assign Parallel Lanes

Group tasks into execution waves — sets of tasks that can run concurrently:

- **Wave 0**: Tasks with no dependencies (often `New Types`, foundational setup, or red tests that run against existing code)
- **Wave 1**: Tasks whose dependencies are all in wave 0
- **Wave N**: Tasks whose dependencies are all in waves < N

Tasks in the same wave run in parallel. Waves execute sequentially.

### 7. Write tasks.md

Write the output to `.conclave/specs/<spec-name>/tasks.md`.

#### Format

````markdown
# <Spec Name> — Tasks

<One-sentence summary of the parallelization strategy.>

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Short task name",
    "ucs": ["UC-1", "UC-2"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": ["server/spec-scanner.ts"],
      "modify": ["server/types.ts", "server/index.ts"]
    },
    "description": "Brief description of what this task accomplishes."
  }
]
```

## Wave 0 (parallel)

### T-0: Short task name
- **UCs**: UC-1, UC-2
- **Files**: create `server/spec-scanner.ts`, modify `server/types.ts`, modify `server/index.ts`
- **Summary**: What to build and why.
- **Tests**: Key test scenarios from implementation.md.

### T-1: Another independent task
...

## Wave 1 (after wave 0)

### T-2: Dependent task
- **Depends on**: T-0
...
````

#### Field Definitions

Read `skills/conclave/references/tasks.md` for the full schema and field definitions.

#### Guidelines

- The JSON block is the machine-readable source of truth. The markdown sections below it are the human-readable expanded view with full context from implementation.md.
- Each markdown task section should include enough context (files, steps, tests) that an agent can execute it without reading implementation.md — the orchestrator will feed these sections as agent prompts.
- Preserve the planner's step details and test scenarios — don't summarize away actionable information.
- Flag potential conflict risks in task descriptions (e.g., "Modifies `index.ts` — coordinate with T-3 if running in same wave").

### 8. Confirm with User

After writing tasks.md, present:
- Total task count and wave count
- Which tasks run in parallel vs sequentially and why
- Any granularity decisions made (splits, merges, convention tasks)
- Offer to adjust groupings or wave assignments

When you're ready for the next phase, read `skills/conclave/references/next.md` for the schema, then emit a `conclave:next` fenced code block:

````
```conclave:next
{"label":"Continue to Orchestration","command":"/orc <spec-name>","metaContext":"<spec-name>"}
```
````

Replace `<spec-name>` with the resolved spec directory name.
