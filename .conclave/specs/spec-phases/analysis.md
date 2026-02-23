# Spec Phase Renames

Rename the spec pipeline's phase files and detection logic to match what each file actually represents. The current `implementation.md` is a breakdown (not implementation), and `tasks.md` is a machine-readable task graph that should be JSON. The four-phase progression becomes: `research.md` -> `analysis.md` -> `breakdown.md` -> `implementation.json`.

## Decisions

- **Four phases, not three.** The `SpecPhase` type expands to `"research" | "analysis" | "breakdown" | "implementation"`. The new `"breakdown"` phase replaces the old `"implementation"` phase for the planning output.
- **breakdown.md replaces implementation.md.** The `/plan` skill's output is a breakdown of use cases into file-level steps — not implementation. The name `breakdown.md` describes its content accurately.
- **implementation.json replaces tasks.md.** The task graph is pure structured data consumed only by the orchestrator. JSON eliminates the redundant markdown wrapper and prose wave descriptions. The phase name "implementation" fits — having `implementation.json` means the spec is ready for orchestrated execution.
- **Phase detection priority.** Highest phase file wins: `implementation.json` > `breakdown.md` > `analysis.md` > `research.md`.
- **Existing spec files are migrated.** Specs with `implementation.md` and/or `tasks.md` are renamed in place.

## Use Cases

### UC-1: Detect four-phase progression (High)
- **Actor:** System
- **Summary:** The spec scanner detects all four phases by checking for phase-indicator files with the new names.
- **Given:** The server starts or a spec directory changes on disk
- **When:** The spec scanner runs against `.conclave/specs/<name>/`
- **Then:**
  - `research.md` maps to phase `"research"`
  - `analysis.md` maps to phase `"analysis"`
  - `breakdown.md` maps to phase `"breakdown"`
  - `implementation.json` maps to phase `"implementation"`
  - The highest-phase file present wins (`implementation.json` > `breakdown.md` > `analysis.md` > `research.md`)
  - A `SpecListUpdated` event is emitted with the updated phase for each spec

### UC-2: Display breakdown phase badge (High, depends on UC-1)
- **Actor:** End User
- **Summary:** The workspace sidebar shows a "breakdown" phase badge for specs that have a `breakdown.md` file.
- **Given:** A spec has `breakdown.md` as its highest phase file
- **When:** The workspace renders the spec list
- **Then:**
  - The spec entry shows a "breakdown" badge
  - The badge has distinct styling (differentiable from research, analysis, and implementation badges)

### UC-3: Planner writes breakdown.md (High)
- **Actor:** System
- **Summary:** The planner skill writes its output to `breakdown.md` instead of `implementation.md`.
- **Given:** A spec has an `analysis.md` with use cases and event models
- **When:** The user runs `/plan` for a spec
- **Then:**
  - The planner writes `.conclave/specs/<name>/breakdown.md`
  - The file is no longer named `implementation.md`

### UC-4: Organizer writes implementation.json (High)
- **Actor:** System
- **Summary:** The organizer skill writes a pure JSON task graph to `implementation.json`, dropping the markdown wrapper and prose wave descriptions.
- **Given:** A spec has a `breakdown.md` with file-level implementation steps
- **When:** The user runs `/org` for a spec
- **Then:**
  - The organizer writes `.conclave/specs/<name>/implementation.json`
  - The file contains a raw JSON array of task objects (no markdown wrapper, no `conclave:tasks` fenced block)
  - Human-readable wave descriptions are omitted

### UC-5: Orchestrator reads implementation.json (High, depends on UC-4)
- **Actor:** System
- **Summary:** The orchestrator reads the task graph directly from `implementation.json` without parsing markdown.
- **Given:** A spec has an `implementation.json` file
- **When:** The user runs `/orc` for a spec
- **Then:**
  - The orchestrator reads `implementation.json` as JSON directly
  - No markdown parsing or `conclave:tasks` block extraction is needed
  - Task execution proceeds as before (wave ordering, dependency tracking)

### UC-6: Update ACP system prompt for new file names (Medium)
- **Actor:** System
- **Summary:** The system prompt injected into ACP sessions references the updated file names.
- **Given:** An ACP session is created or loaded
- **When:** The server injects the system prompt into the ACP session
- **Then:**
  - The system prompt mentions `breakdown.md` instead of `implementation.md`
  - The system prompt mentions `implementation.json` as the task graph file

### UC-7: Update epic group summary text (Medium, depends on UC-1)
- **Actor:** End User
- **Summary:** The epic group summary in the workspace sidebar uses the correct phase names instead of hardcoded text.
- **Given:** An epic has child specs at various phases
- **When:** The workspace renders the epic group
- **Then:**
  - The summary text reflects the actual highest phase (e.g., "X of Y in breakdown" or "X of Y in implementation")
  - The text is not hardcoded to a single phase name

### UC-8: Migrate existing spec files (Medium)
- **Actor:** System
- **Summary:** Existing specs with `implementation.md` and/or `tasks.md` are renamed to the new file names.
- **Given:** Specs exist under `.conclave/specs/` with old file names
- **When:** The migration is performed
- **Then:**
  - `implementation.md` is renamed to `breakdown.md` in each affected spec
  - `tasks.md` content has its `conclave:tasks` JSON extracted and written as `implementation.json`
  - The spec scanner detects the new files correctly

### UC-9: Update project documentation (Medium)
- **Actor:** System
- **Summary:** CLAUDE.md and conclave skill references are updated to reflect the new file names and phase progression.
- **Given:** The rename is decided
- **When:** Documentation files are updated
- **Then:**
  - CLAUDE.md references `breakdown.md` and `implementation.json`
  - The conclave skill's `references/tasks.md` reflects the new JSON-only format and `implementation.json` file name
  - The ACP system prompt template in CLAUDE.md matches the new convention
