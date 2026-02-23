# Spec Phase Renames — Tasks

Code tasks follow TDD red-green ordering (tests in earlier waves than implementation). Convention tasks (skill file edits) run in parallel with code tasks since they touch disjoint files. UC-6 and UC-9 are merged because both modify CLAUDE.md.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "New Types — expand SpecPhase union",
    "ucs": ["UC-1", "UC-2"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["server/types.ts", "client/types.ts"]
    },
    "description": "Expand the SpecPhase type to include \"breakdown\" on both server and client. In server/types.ts, change SpecPhase from '\"research\" | \"analysis\" | \"implementation\"' to '\"research\" | \"analysis\" | \"breakdown\" | \"implementation\"'. In client/types.ts, change the phase field on SpecInfo from '\"research\" | \"analysis\" | \"implementation\" | null' to '\"research\" | \"analysis\" | \"breakdown\" | \"implementation\" | null'. No other changes — this is a structural prerequisite so tests in T-1 can import the new type without failing for structural reasons."
  },
  {
    "id": "T-1",
    "name": "Red: scanner tests for new phase files",
    "ucs": ["UC-1"],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["server/spec-scanner.test.ts"]
    },
    "description": "Write failing tests for the new phase detection logic. In server/spec-scanner.test.ts:\n\n1. Update the existing test 'spec with both analysis.md and implementation.md has phase implementation' — change it to use breakdown.md and implementation.json respectively.\n2. Add new test: spec with only breakdown.md → phase \"breakdown\".\n3. Add new test: spec with both breakdown.md and analysis.md → phase \"breakdown\" (breakdown wins).\n4. Add new test: spec with implementation.json and breakdown.md → phase \"implementation\" (implementation wins).\n5. Add new test: spec with only implementation.json → phase \"implementation\".\n6. Existing tests for analysis.md and research.md remain unchanged.\n\nThese tests should FAIL (red) against the current spec-scanner.ts because it doesn't know about breakdown.md or implementation.json yet. The failures should be meaningful assertion failures (e.g., expected \"breakdown\" but got null), not import errors."
  },
  {
    "id": "T-2",
    "name": "Update planner skill — write breakdown.md",
    "ucs": ["UC-3"],
    "depends": [],
    "wave": 0,
    "kind": "convention",
    "files": {
      "create": [],
      "modify": ["skills/planner/SKILL.md"]
    },
    "description": "In skills/planner/SKILL.md, replace all references to implementation.md (as the planner's output file) with breakdown.md:\n- Description line: '…into a concrete breakdown plan (breakdown.md).'\n- Section '### 4. Produce the Implementation Plan' → write path becomes .conclave/specs/<spec-name>/breakdown.md\n- Section '### 5. Confirm with User' → 'After writing breakdown.md…'\n- Keep the heading 'Implementation Plan' inside breakdown.md — the file's internal structure doesn't change, only the file name."
  },
  {
    "id": "T-3",
    "name": "Update organizer skill + conclave refs — write implementation.json",
    "ucs": ["UC-4"],
    "depends": [],
    "wave": 0,
    "kind": "convention",
    "files": {
      "create": [],
      "modify": ["skills/organizer/SKILL.md", "skills/conclave/references/tasks.md"]
    },
    "description": "Two files to update:\n\n1. In skills/organizer/SKILL.md:\n   - Change input references from implementation.md to breakdown.md.\n   - Change output from tasks.md to implementation.json.\n   - In the 'Write tasks.md' section (rename to 'Write implementation.json'): instruct the organizer to write a raw JSON file (the task array directly), not a markdown file with a fenced conclave:tasks block.\n   - Remove references to 'human-readable wave sections' below the JSON block — the markdown wave descriptions move into agent prompt context within the orchestrator, not into the output file.\n   - The JSON array schema stays the same (id, name, ucs, depends, wave, kind, files, description).\n   - Expand the description field guidance: since there are no longer separate markdown sections, each task's description must contain enough context (files, steps, tests) for an agent to execute without reading breakdown.md.\n\n2. In skills/conclave/references/tasks.md:\n   - Update 'Emission Rules' section: written to .conclave/specs/<name>/implementation.json as a raw JSON file (no markdown wrapper, no conclave:tasks fenced block).\n   - Update introductory description to reflect implementation.json."
  },
  {
    "id": "T-4",
    "name": "Update orchestrator skill — read implementation.json",
    "ucs": ["UC-5"],
    "depends": ["T-3"],
    "wave": 1,
    "kind": "convention",
    "files": {
      "create": [],
      "modify": ["skills/orchestrator/SKILL.md"]
    },
    "description": "In skills/orchestrator/SKILL.md:\n1. Change all references from tasks.md to implementation.json.\n2. In '### 1. Parse the Task Graph': read .conclave/specs/<spec-name>/implementation.json and JSON.parse() it directly — no markdown parsing or conclave:tasks block extraction needed.\n3. Change the missing-file message from 'run the organizer first' referencing tasks.md to referencing implementation.json.\n4. Update references to implementation.md (as the full plan) to breakdown.md.\n5. In the commit file lists, change tasks.md to implementation.json and implementation.md to breakdown.md.\n6. Update the initial commit description that lists spec files: spec.json, research.md, analysis.md, breakdown.md, implementation.json."
  },
  {
    "id": "T-5",
    "name": "Green: implement scanner + CSS badge + epic summary",
    "ucs": ["UC-1", "UC-2", "UC-7"],
    "depends": ["T-1"],
    "wave": 2,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["server/spec-scanner.ts", "client/style.css", "client/components/workspace.tsx"]
    },
    "description": "Three changes in one task (no file conflicts between them, all depend on T-0 types and T-1 tests):\n\n**UC-1 — Scanner logic (server/spec-scanner.ts):**\nReplace the three file-existence checks with four, in descending priority order:\n- implementation.json → phase \"implementation\"\n- breakdown.md → phase \"breakdown\"\n- analysis.md → phase \"analysis\"\n- research.md → phase \"research\"\nHighest wins. Remove the implementation.md check entirely.\n\n**UC-2 — Breakdown badge (client/style.css):**\nAdd a .spec-entry__phase--breakdown rule after .spec-entry__phase--analysis. Use a blue/purple tone: color: var(--accent-blue, #7ba4d4); background: rgba(123, 164, 212, 0.1). No component changes needed — workspace.tsx already renders spec-entry__phase--${spec.phase} dynamically.\n\n**UC-7 — Epic group summary (client/components/workspace.tsx):**\nIn EpicGroupRow, replace the hardcoded \"implementation\" filter with dynamic logic:\n- Define phase order: research < analysis < breakdown < implementation.\n- Find the highest phase present among any child spec.\n- Count how many children have reached that highest phase.\n- Render: \"${count} of ${total} in ${highestPhase}\".\n- If all children have phase: null, render no summary.\n\n**Final step:** Run the T-1 scanner tests — all must pass green. Run `bun test server/spec-scanner.test.ts`."
  },
  {
    "id": "T-6",
    "name": "Update CLAUDE.md — phase refs and documentation",
    "ucs": ["UC-6", "UC-9"],
    "depends": [],
    "wave": 0,
    "kind": "convention",
    "files": {
      "create": [],
      "modify": ["CLAUDE.md"]
    },
    "description": "Merge UC-6 and UC-9 since both modify CLAUDE.md. Updates:\n\n1. Update the 'Specs live in...' line: 'Each spec directory contains phase files (analysis.md, breakdown.md) and an optional spec.json with description, type, and epic fields.'\n2. In the custom markdown blocks section, update references: tasks.md schema file documents the implementation.json format.\n3. Document the four-phase progression: research.md → analysis.md → breakdown.md → implementation.json.\n4. Update any references to implementation.md (planner output) to breakdown.md.\n5. Update any references to tasks.md (organizer output) to implementation.json.\n6. Since CLAUDE.md is injected into ACP sessions as the system prompt, this automatically updates what Claude sees in new sessions."
  },
  {
    "id": "T-7",
    "name": "Migrate existing spec files",
    "ucs": ["UC-8"],
    "depends": ["T-5"],
    "wave": 3,
    "kind": "code",
    "files": {
      "create": [],
      "modify": []
    },
    "description": "One-time migration of existing spec files under .conclave/specs/:\n\n1. For each directory in .conclave/specs/:\n   - If implementation.md exists, rename to breakdown.md (using git mv for history).\n   - If tasks.md exists, read it, extract the JSON array from the conclave:tasks fenced code block, and write it as implementation.json. Delete tasks.md.\n2. Run the scanner to verify: execute a quick check that scanSpecs() returns correct phases for all existing specs.\n3. Verify no implementation.md or tasks.md files remain under .conclave/specs/.\n\nThis is a one-time operation — no ongoing code needed. The migration script is not committed as production code."
  }
]
```

## Wave 0 (parallel)

### T-0: New Types — expand SpecPhase union
- **UCs**: UC-1, UC-2
- **Files**: modify `server/types.ts`, modify `client/types.ts`
- **Summary**: Structural prerequisite. Expand `SpecPhase` to include `"breakdown"` on both server and client so that downstream tests can import the type without structural failures.
- **Tests**: None — type-only change verified by TypeScript compilation.

### T-2: Update planner skill — write breakdown.md
- **UCs**: UC-3
- **Kind**: convention
- **Files**: modify `skills/planner/SKILL.md`
- **Summary**: Replace all references to `implementation.md` (as planner output) with `breakdown.md` in the planner skill definition. Keep the internal structure of the generated file unchanged.

### T-3: Update organizer skill + conclave refs — write implementation.json
- **UCs**: UC-4
- **Kind**: convention
- **Files**: modify `skills/organizer/SKILL.md`, modify `skills/conclave/references/tasks.md`
- **Summary**: Update the organizer to write `implementation.json` (raw JSON, no markdown wrapper) instead of `tasks.md`. Update input references from `implementation.md` to `breakdown.md`. Update the conclave tasks reference to reflect the JSON-only format.

### T-6: Update CLAUDE.md — phase refs and documentation
- **UCs**: UC-6, UC-9
- **Kind**: convention
- **Files**: modify `CLAUDE.md`
- **Summary**: Merge UC-6 and UC-9. Update all spec pipeline references in CLAUDE.md: `implementation.md` → `breakdown.md`, `tasks.md` → `implementation.json`. Document the four-phase progression.

## Wave 1 (after wave 0)

### T-1: Red — scanner tests for new phase files
- **UCs**: UC-1
- **Depends on**: T-0
- **Files**: modify `server/spec-scanner.test.ts`
- **Summary**: Write failing tests for `breakdown.md` and `implementation.json` detection. Update existing `implementation.md` test to use new file names. Tests fail red because the scanner doesn't know about the new files yet.
- **Tests**:
  - Spec with only `breakdown.md` → phase `"breakdown"`
  - Spec with both `breakdown.md` and `analysis.md` → phase `"breakdown"`
  - Spec with `implementation.json` and `breakdown.md` → phase `"implementation"`
  - Spec with only `implementation.json` → phase `"implementation"`
  - Update existing `implementation.md` test → use `breakdown.md`/`implementation.json`

### T-4: Update orchestrator skill — read implementation.json
- **UCs**: UC-5
- **Kind**: convention
- **Depends on**: T-3
- **Files**: modify `skills/orchestrator/SKILL.md`
- **Summary**: Update the orchestrator to read `implementation.json` directly (JSON.parse, no markdown parsing). Update all file name references: `tasks.md` → `implementation.json`, `implementation.md` → `breakdown.md`.

## Wave 2 (after wave 1)

### T-5: Green — implement scanner + CSS badge + epic summary
- **UCs**: UC-1, UC-2, UC-7
- **Depends on**: T-1
- **Files**: modify `server/spec-scanner.ts`, modify `client/style.css`, modify `client/components/workspace.tsx`
- **Summary**: The green phase. Three independent changes bundled because they all depend on T-1 completing and touch disjoint files:
  1. **Scanner**: Replace three file checks with four (`implementation.json` > `breakdown.md` > `analysis.md` > `research.md`).
  2. **CSS**: Add `.spec-entry__phase--breakdown` rule with blue/purple styling.
  3. **Epic summary**: Replace hardcoded `"implementation"` filter with dynamic highest-phase logic.
- **Tests**: Run T-1 scanner tests — all must pass green. `bun test server/spec-scanner.test.ts`.

## Wave 3 (after wave 2)

### T-7: Migrate existing spec files
- **UCs**: UC-8
- **Depends on**: T-5
- **Files**: One-time file renames under `.conclave/specs/`
- **Summary**: Rename `implementation.md` → `breakdown.md` and extract `tasks.md` JSON into `implementation.json` for all existing specs. Verify with scanner that phases detect correctly. Not committed as production code.
