# Event Model Architect Integration — Implementation

Update the architect skill to emit `conclave:eventmodel` fenced code blocks instead of the previous markdown `#### Event Model` sections, and update downstream skills (planner) to consume the new format. All changes are to skill definition files (SKILL.md), not application code.

## UC-1: Architect emits event model blocks

**Files:**
- `skills/architect/SKILL.md` — replace markdown event model format with `conclave:eventmodel` block format
- `skills/planner/SKILL.md` — add parsing instructions for `conclave:eventmodel` blocks

### Steps

1. In `skills/architect/SKILL.md` step 1 (Locate the Spec), add **epic resolution** — when `spec.json` has an `"epic"` field, read the epic's `analysis.md` first for shared decisions and schema context.

2. In step 4 (Augment analysis.md), replace the markdown format template:
   - Change placement from `#### Event Model` subsection under each UC heading to a single `## Event Model` section after all use cases
   - Replace the markdown Command/Events/Projections/Side Effects template with a `conclave:eventmodel` JSON block example
   - Reference the parent epic's schema at `.conclave/specs/event-model-diagram/analysis.md`
   - Add guidance: "All tiers are optional — a reactive slice may have only projections"
   - Add guidance: "Use `feeds` to declare cross-slice connections by target node name"
   - Update "emit one slice for the group" phrasing to match block-per-slice model

3. Update guidelines subsection:
   - Change "Flag new vs existing" to reference `new` boolean instead of text markers
   - Add note that file paths and function signatures belong in the planner, not the architect
   - Remove "Keep it architectural" bullet (redundant with the above)

4. In `skills/planner/SKILL.md`:
   - Add epic resolution to step 1 (same pattern as architect)
   - Rename step 3 from "Parse Use Cases" to "Parse Use Cases and Event Models"
   - Add `conclave:eventmodel` block extraction instructions with field-to-implementation mappings (command→handler, events→types+reducers, projections→read models, sideEffects→broadcasts, feeds→integration points)

### Tests

Since these are skill definition files (prompt instructions, not executable code), there are no automated tests. Validation is manual:
- Run `/arq` on a spec with use cases → verify it emits `conclave:eventmodel` blocks instead of markdown event model sections
- Run `/plan` on a spec with `conclave:eventmodel` blocks in its analysis.md → verify the planner references slice data correctly

### Status

All changes were implemented in commit `6ecc760` ("feat(specs): add event-model-diagram epic with child specs and skill updates"). This implementation plan documents the work retroactively for pipeline completeness.
