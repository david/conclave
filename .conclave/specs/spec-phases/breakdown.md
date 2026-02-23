# Spec Phase Renames — Implementation

Rename the spec pipeline's four-phase progression from `research.md → analysis.md → implementation.md → tasks.md` to `research.md → analysis.md → breakdown.md → implementation.json`. This is a rename/refactor with no new domain events or commands — only the `SpecPhase` type expands to include `"breakdown"`, phase detection checks new file names, and the three pipeline skills update their I/O targets.

## New Types

**`SpecPhase` expansion** (server and client):

```typescript
// server/types.ts
export type SpecPhase = "research" | "analysis" | "breakdown" | "implementation";

// client/types.ts (inline in SpecInfo)
phase: "research" | "analysis" | "breakdown" | "implementation" | null;
```

No new events, commands, or projections.

## UC-1: Detect four-phase progression

**Files:**
- `server/types.ts` — expand `SpecPhase` union
- `server/spec-scanner.ts` — update phase detection logic
- `server/spec-scanner.test.ts` — update and add test cases

**Steps:**
1. In `server/types.ts`, change `SpecPhase` from `"research" | "analysis" | "implementation"` to `"research" | "analysis" | "breakdown" | "implementation"`.
2. In `server/spec-scanner.ts`, replace the three file-existence checks with four:
   - `implementation.json` → phase `"implementation"`
   - `breakdown.md` → phase `"breakdown"`
   - `analysis.md` → phase `"analysis"`
   - `research.md` → phase `"research"`
   - Highest wins (check in descending priority order).
3. Remove the `implementation.md` check entirely — it is no longer a recognized phase file.

**Tests:**
- Spec with only `breakdown.md` → phase `"breakdown"`
- Spec with both `breakdown.md` and `analysis.md` → phase `"breakdown"` (breakdown wins)
- Spec with `implementation.json` and `breakdown.md` → phase `"implementation"` (implementation wins)
- Spec with only `implementation.json` → phase `"implementation"`
- Update existing test "spec with both analysis.md and implementation.md has phase 'implementation'" → change to use `breakdown.md` and `implementation.json` respectively
- Existing tests for `analysis.md` and `research.md` remain unchanged

## UC-2: Display breakdown phase badge

**Files:**
- `client/types.ts` — expand `SpecInfo.phase` union
- `client/style.css` — add `.spec-entry__phase--breakdown` rule

**Steps:**
1. In `client/types.ts`, change the `phase` field on `SpecInfo` from `"research" | "analysis" | "implementation" | null` to `"research" | "analysis" | "breakdown" | "implementation" | null`.
2. In `client/style.css`, add a `.spec-entry__phase--breakdown` rule after `.spec-entry__phase--analysis`. Use a blue/purple tone to differentiate from analysis (amber) and implementation (green) — e.g. `color: var(--accent-blue, #7ba4d4); background: rgba(123, 164, 212, 0.1);`.
3. No component changes needed — `SpecEntry` in `workspace.tsx` already renders `spec-entry__phase--${spec.phase}` dynamically, so `"breakdown"` gets the new class automatically.

**Tests:**
- Visual verification: spec with phase `"breakdown"` renders the breakdown badge with distinct styling

## UC-7: Update epic group summary text

**Files:**
- `client/components/workspace.tsx` — fix `EpicGroupRow` summary logic

**Steps:**
1. In `EpicGroupRow`, replace the hardcoded `"implementation"` filter and text with dynamic logic that finds the highest phase among children and counts how many have reached it. Specifically:
   - Define a phase order: `research < analysis < breakdown < implementation`.
   - Find the highest phase present among any child spec.
   - Count how many children have reached that highest phase.
   - Render: `"${count} of ${total} in ${highestPhase}"`.
2. If all children have `phase: null`, render no summary (same as current behavior when `total === 0`).

**Tests:**
- Epic with 3 children (2 breakdown, 1 analysis) → summary: `"2 of 3 in breakdown"`
- Epic with 2 children (1 implementation, 1 breakdown) → summary: `"1 of 2 in implementation"`
- Epic with all null phases → no summary text

## UC-3: Planner writes breakdown.md

**Files:**
- `.claude/skills/planner/SKILL.md` — update output file references

**Steps:**
1. Replace all references to `implementation.md` (as the planner's output file) with `breakdown.md`:
   - Description line: "…into a concrete breakdown plan (breakdown.md)."
   - Section "### 4. Produce the Implementation Plan" → write path becomes `.conclave/specs/<spec-name>/breakdown.md`
   - Section "### 5. Confirm with User" → "After writing breakdown.md…"
2. Keep the heading "Implementation Plan" inside breakdown.md — the file's internal structure doesn't change, only the file name.

**Tests:**
- Planner skill invocation writes `breakdown.md` (manual verification via skill execution)

## UC-4: Organizer writes implementation.json

**Files:**
- `.claude/skills/organizer/SKILL.md` — update input/output file references and JSON format instructions
- `.claude/skills/conclave/references/tasks.md` — update for JSON-only format and new file name

**Steps:**
1. In `skills/organizer/SKILL.md`:
   - Change input references from `implementation.md` to `breakdown.md`.
   - Change output from `tasks.md` to `implementation.json`.
   - In the "Write tasks.md" section (rename to "Write implementation.json"): instruct the organizer to write a raw JSON file (the task array directly), not a markdown file with a fenced `conclave:tasks` block.
   - Remove references to "human-readable wave sections" below the JSON block — the markdown wave descriptions move into agent prompt context within the orchestrator, not into the output file.
   - The JSON array schema stays the same (id, name, ucs, depends, wave, kind, files, description).
   - Expand the `description` field guidance: since there are no longer separate markdown sections, each task's `description` must contain enough context (files, steps, tests) for an agent to execute without reading breakdown.md.
2. In `skills/conclave/references/tasks.md`:
   - Update "Emission Rules" section: written to `.conclave/specs/<name>/implementation.json` as a raw JSON file (no markdown wrapper, no `conclave:tasks` fenced block).
   - Update introductory description to reflect `implementation.json`.

**Tests:**
- Organizer skill invocation writes `implementation.json` as valid JSON (manual verification)

## UC-5: Orchestrator reads implementation.json

**Files:**
- `.claude/skills/orchestrator/SKILL.md` — update input file references and parsing instructions

**Steps:**
1. Change all references from `tasks.md` to `implementation.json`.
2. In "### 1. Parse the Task Graph": read `.conclave/specs/<spec-name>/implementation.json` and `JSON.parse()` it directly — no markdown parsing or `conclave:tasks` block extraction needed.
3. Change the missing-file message from "run the organizer first" referencing `tasks.md` to referencing `implementation.json`.
4. Update references to `implementation.md` (as the full plan) to `breakdown.md`.
5. In the commit file lists, change `tasks.md` to `implementation.json` and `implementation.md` to `breakdown.md`.
6. Update the initial commit description that lists spec files: `spec.json`, `research.md`, `analysis.md`, `breakdown.md`, `implementation.json`.

**Tests:**
- Orchestrator reads `implementation.json` directly (manual verification via skill execution)

## UC-6: Update ACP system prompt for new file names

**Files:**
- `CLAUDE.md` — update spec pipeline references

**Steps:**
1. In the "Specs live in..." line (if present) or the custom markdown blocks section of `CLAUDE.md`, update any references to the pipeline file names:
   - `implementation.md` → `breakdown.md` (planner output)
   - `tasks.md` → `implementation.json` (organizer output)
2. Since CLAUDE.md is injected into ACP sessions as the system prompt, this automatically updates what Claude sees in new sessions.

**Tests:**
- Verify CLAUDE.md references are consistent with the new naming

## UC-8: Migrate existing spec files

**Files:**
- One-time migration script (run manually, not committed as production code)

**Steps:**
1. For each directory in `.conclave/specs/`:
   - If `implementation.md` exists, rename to `breakdown.md`.
   - If `tasks.md` exists, read it, extract the JSON array from the `conclave:tasks` fenced code block, and write it as `implementation.json`. Delete `tasks.md`.
2. Run the migration manually. Verify with `scanSpecs()` that phases are detected correctly.
3. The migration is a one-time operation — no ongoing code needed.

**Tests:**
- After migration, `scanSpecs()` returns correct phases for all existing specs
- No `implementation.md` or `tasks.md` files remain under `.conclave/specs/`

## UC-9: Update project documentation

**Files:**
- `CLAUDE.md` — update phase/file references throughout
- `.claude/skills/conclave/references/tasks.md` — already covered in UC-4

**Steps:**
1. In `CLAUDE.md`, update the line about spec directories: "Each spec directory contains phase files (analysis.md, breakdown.md) and an optional spec.json..." (or similar).
2. Update the custom markdown blocks section: reference `tasks.md` schema file in `references/` still exists but documents the `implementation.json` format.
3. Ensure the four-phase progression is documented: `research.md → analysis.md → breakdown.md → implementation.json`.

**Tests:**
- Documentation review: all references to old file names are updated
