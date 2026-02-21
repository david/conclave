# Event Model Planner Integration — Implementation

Update the planner skill to parse `conclave:eventmodel` blocks from analysis.md and use the structured event model data to inform implementation plans. All changes are to the skill definition file (SKILL.md), not application code.

## UC-1: Planner reads event model blocks

**Files:**
- `skills/planner/SKILL.md` — add event model parsing instructions and epic resolution

### Steps

1. In step 1 (Locate the Spec), add **epic resolution** — when `spec.json` has an `"epic"` field, read the epic's `analysis.md` at `.conclave/specs/<epic>/analysis.md` first to load shared decisions, schemas, and constraints before planning.

2. Rename step 3 from "Parse Use Cases" to **"Parse Use Cases and Event Models"** to reflect the expanded scope.

3. Add `conclave:eventmodel` block extraction instructions after the existing `conclave:usecase` extraction. For each slice, the planner should note:
   - `command` → maps to a command handler and command type
   - `events` → map to event types and slice reducers
   - `projections` → map to read model classes and state types
   - `sideEffects` → map to WS broadcasts, ACP calls, or client slice updates
   - `feeds` → cross-slice connections inform integration points and test boundaries

### Tests

Skill definition files are prompt instructions, not executable code. Validation is manual:
- Run `/plan` on a spec whose analysis.md contains `conclave:eventmodel` blocks → verify the implementation plan references slice data (commands, events, projections) when determining files to create and types to define

### Status

All changes were implemented in commit `6ecc760` ("feat(specs): add event-model-diagram epic with child specs and skill updates"). This implementation plan documents the work retroactively for pipeline completeness.
