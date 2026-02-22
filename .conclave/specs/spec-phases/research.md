# Spec Phase System Revisions

Exploring changes to how spec phases are named, detected, and displayed in the workspace sidebar.

## Context

The spec pipeline has grown since the original spec-system was built. It now has five skills producing files:

| Skill | Output file | Purpose |
|-------|-------------|---------|
| `/rsrc` | `research.md` | Problem space exploration |
| `/req` | `analysis.md` | Use cases and requirements |
| `/arq` | `analysis.md` (augmented) | Event models added to analysis |
| `/plan` | `implementation.md` | File-level breakdown of changes |
| `/org` | `tasks.md` | Parallelized task graph for orchestrator |

The phase detection system only knows about three phases (`research`, `analysis`, `implementation`), and the naming doesn't match the pipeline well.

## Problems

1. **Missing phases.** `research.md` and `tasks.md` exist in the pipeline but aren't reflected in the phase system. A spec with only `research.md` shows no phase badge (fixed recently), but `tasks.md` has no corresponding phase at all.

2. **"implementation" is a misnomer.** The file called `implementation.md` is a *plan/breakdown* — it lists what files to change and how. Actual implementation happens when the orchestrator executes `tasks.md`. Calling the planning phase "implementation" is confusing.

3. **`tasks.md` is redundant prose.** The organizer currently writes `tasks.md` as markdown containing a `conclave:tasks` JSON block *plus* human-readable wave descriptions. But the prose duplicates information that already exists in the JSON task `description` fields and in the breakdown file. The only consumer of the JSON is the orchestrator, and no one reads the prose.

## Findings

### File rename: `implementation.md` -> `breakdown.md`

The `/plan` skill's output is a breakdown — it decomposes use cases into file-level steps. Renaming to `breakdown.md` accurately describes its content and frees up "implementation" for the phase that actually represents implementation readiness.

### File rename + format change: `tasks.md` -> `implementation.json`

The task graph is pure structured data. Making it JSON:
- Eliminates the redundant prose wave descriptions
- Removes the need for markdown parsing to extract the `conclave:tasks` block
- Makes the file format match its content (machine-readable task graph)
- The phase name "implementation" fits — having an `implementation.json` means the spec is ready for orchestrated execution

### Updated phase progression

```
research.md -> analysis.md -> breakdown.md -> implementation.json
   /rsrc          /req           /plan             /org
```

Phase detection priority (highest wins):
1. `implementation.json` -> phase: `"implementation"`
2. `breakdown.md` -> phase: `"breakdown"`
3. `analysis.md` -> phase: `"analysis"`
4. `research.md` -> phase: `"research"`

### Impact on existing code and skills

**Server (`spec-scanner.ts`):**
- Check for `breakdown.md` instead of `implementation.md`
- Add check for `implementation.json`
- Update `SpecPhase` type to include `"breakdown"`

**Client (`workspace.tsx`, `style.css`, `types.ts`):**
- Add `"breakdown"` to `SpecPhase` type
- Add CSS badge style for `breakdown` phase
- Update epic group summary text (currently hardcoded to "in implementation")

**Skills:**
- `/plan` (planner): write `breakdown.md` instead of `implementation.md`
- `/org` (organizer): write `implementation.json` instead of `tasks.md`, drop prose wave descriptions
- `/orc` (orchestrator): read `implementation.json` instead of parsing `conclave:tasks` from `tasks.md`

**Conclave skill (`references/tasks.md`):**
- Update emission rules to reference `implementation.json`
- Simplify — no more markdown wrapper

**Existing specs:**
- `.conclave/specs/services-panel/` has both `implementation.md` and `tasks.md` that would need renaming
- `.conclave/specs/spec-system/` has `implementation.md` that would need renaming

## Open Questions

- Should the CLAUDE.md project instructions be updated to reflect the new file names? (Probably yes, at least the pipeline description.)

## Leanings

- Rename `implementation.md` -> `breakdown.md`, displayed as "breakdown" phase
- Rename `tasks.md` -> `implementation.json` (pure JSON, no markdown wrapper), displayed as "implementation" phase
- Drop the human-readable wave descriptions from the task file — they're redundant
- Four phases total: `research` -> `analysis` -> `breakdown` -> `implementation`
