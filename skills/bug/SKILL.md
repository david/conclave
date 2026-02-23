---
name: bug
description: >
  Debug and triage bugs to produce a diagnosis and fix plan for other skills to implement.
  Investigates root cause, identifies missing test coverage, and outputs research.md and
  implementation.md into the spec pipeline. Use when the user reports a bug, unexpected behavior,
  or regression and wants to understand why it happened before fixing it.
  Triggers on: "debug...", "triage...", "why is X broken", "investigate this bug",
  "/bug", "/bug <description>". Does NOT fix the bug itself — produces artifacts for
  /org → /orc (or /dev) to execute. Does NOT handle already-failing tests — use /dev for those.
---

# Bug

Investigate a bug, diagnose its root cause, identify what tests would have caught it, and produce a fix plan that other skills can execute.

## Pipeline Position

`/bug <description>` → `research.md` + `implementation.md` → `/org` → `/orc`

The bug skill replaces `/rsrc` + `/req` + `/arq` + `/plan` for bug work. Its output slots directly into the task decomposition phase.

## Workflow

### 1. Create or Resolve Spec

Bugs get their own spec directory, prefixed `bug-`.

1. Derive a short kebab-case name from the bug description (e.g., `bug-stale-session-picker`).
2. Create `.conclave/specs/bug-<name>/spec.json`:
   ```json
   { "description": "<one-line bug summary>", "type": "bug" }
   ```
3. If an existing `bug-*` spec covers the same issue, reuse it.

### 2. Reproduce

Confirm the bug exists before investigating.

- Read the user's description, error messages, and any referenced code.
- Trace the code path to understand the expected vs. actual behavior.
- If the bug is ambiguous, ask the user for reproduction steps or observable symptoms.
- Do NOT run the application or attempt live reproduction — work from code reading and reasoning.

### 3. Investigate Root Cause

Find the specific code that causes the bug.

- Start from the symptom and trace backwards through the call chain.
- Read all relevant source files — don't guess from names alone.
- Identify the exact location (file, function, line) where behavior diverges from intent.
- Understand *why* the bug exists — was it a logic error, a missing case, a wrong assumption, a race condition?

### 4. Identify Missing Test Coverage

Determine what tests would have caught this bug.

- What test scenario, if it existed, would have failed and revealed this bug before it shipped?
- Is there an existing test that *should* cover this case but doesn't? Why did it miss it?
- Are there adjacent test gaps that the same root cause could expose?

### 5. Write research.md

Write `.conclave/specs/bug-<name>/research.md`. See [references/research-format.md](references/research-format.md) for the format.

This is the durable diagnostic record — it explains the bug for anyone reading it later.

### 6. Write implementation.md

Write `.conclave/specs/bug-<name>/implementation.md`. See [references/implementation-format.md](references/implementation-format.md) for the format.

This is what `/org` picks up to decompose into tasks.

### 7. Next Step

Summarize what was found and written, then suggest:

```
/org bug-<name>
```
