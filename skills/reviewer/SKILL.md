---
name: review
description: >
  Review the artifact produced by a pipeline skill against its review checklist.
  Evaluates the document in isolation — no upstream/downstream context, no codebase
  reading — just the artifact against the checklist criteria. Use when a skill has
  produced its artifact and you want a quality gate before moving to the next phase.
  Triggers on: "/review <skill>", "review the gather-requirements output", "review the architecture",
  "review the plan", "review the tasks".
---

# Reviewer

Evaluate a pipeline skill's artifact against its review checklist. The review is performed in isolation — the artifact must stand on its own.

## Supported Skills

| Argument | Skill | Artifact | Checklist |
|----------|-------|----------|-----------|
| `research` | Researcher | `research.md` | `references/research-checklist.md` |
| `gather-requirements` | Requirements Analyst | `analysis.md` (use cases + decisions) | `references/gather-requirements-checklist.md` |
| `architect` | Architect | `analysis.md` (event model sections) | `references/architect-checklist.md` |
| `plan` | Planner | `implementation.md` | `references/plan-checklist.md` |
| `organize` | Organizer | `tasks.md` | `references/organize-checklist.md` |

## Workflow

### 1. Resolve the Target

Parse the skill argument from the user's command (e.g., `/review gather-requirements`, `/review architect`).

If the user didn't specify a spec name, scan `.conclave/specs/*/` and pick the most recently modified spec that has the relevant artifact. If ambiguous, ask.

### 2. Load the Artifact

Read the artifact file from `.conclave/specs/<spec-name>/`:

| Skill | File to read |
|-------|-------------|
| `research` | `research.md` — the full file |
| `gather-requirements` | `analysis.md` — only the use cases and decisions sections (stop before `## Event Model` if present) |
| `architect` | `analysis.md` — only the `## Event Model` section and its `conclave:eventmodel` blocks |
| `plan` | `implementation.md` — the full file |
| `organize` | `tasks.md` — the full file |

**Do not read any other files.** No `spec.json`, no `CLAUDE.md`, no source code, no upstream or downstream artifacts. The review is conducted in isolation — the artifact must be self-explanatory.

### 3. Load the Checklist

Read the corresponding checklist from this skill's `references/` directory:

- `references/research-checklist.md`
- `references/gather-requirements-checklist.md`
- `references/architect-checklist.md`
- `references/plan-checklist.md`
- `references/organize-checklist.md`

### 4. Evaluate

Walk through each checklist item. For each item:

1. **Check** — Does the artifact satisfy this criterion?
2. **Cite** — Quote or reference the specific part of the artifact that satisfies (or violates) the criterion.
3. **Verdict** — Pass, Fail, or Warn (meets the spirit but could be improved).

### 5. Produce the Review

Output a structured review in chat. Do not write it to a file.

#### Format

```markdown
## Review: /`<skill>` — `<spec-name>`

### Summary

<2-3 sentence overall assessment. Is this artifact ready for the next phase?>

### Results

| # | Criterion | Verdict | Notes |
|---|-----------|---------|-------|
| 1 | <criterion name> | Pass/Fail/Warn | <brief note or quote> |
| 2 | ... | ... | ... |

### Issues

<For each Fail or Warn, expand with:>

#### <#>. <Criterion name> — <Fail/Warn>

**Problem:** <What's wrong>
**Evidence:** <Quote from the artifact>
**Suggestion:** <How to fix it>

### Verdict

**Ready for next phase: Yes / No / Yes with caveats**

<If No, list the blocking issues that must be fixed before proceeding.>
```

### 6. Offer Next Steps

Read `skills/conclave/references/next.md` for the schema.

- If the verdict is **Yes** or **Yes with caveats**: Emit a `conclave:next` block for the next phase based on which skill was reviewed:

| Reviewed | Next label | Next command |
|----------|-----------|-------------|
| `research` | Continue to Requirements | `/gather-requirements <spec-name>` |
| `gather-requirements` | Continue to Architecture | `/architect <spec-name>` |
| `architect` | Continue to Planning | `/plan <spec-name>` |
| `plan` | Continue to Task Organization | `/organize <spec-name>` |
| `organize` | Continue to Orchestration | `/orchestrate <spec-name>` |

````
```conclave:next
{"label":"<label from table>","command":"<command from table>","metaContext":"<spec-name>"}
```
````

  For **Yes with caveats**, also list the non-blocking improvements above the button.

- If **No**: Do not emit a `conclave:next` block. List the blocking issues and suggest re-running the skill (e.g., "You may want to re-run `/gather-requirements <spec-name>` to address these issues").

## Guidelines

- **Isolation is strict.** You have the artifact and the checklist — nothing else. If the artifact is missing context that makes a criterion unjudgeable, that itself is a Fail ("artifact is not self-contained").
- **Be specific.** "Use cases look fine" is not a review. Quote the artifact, name the criterion, give a clear verdict.
- **Calibrate severity.** A missing edge case UC is a Warn; a UC with no testable Then clauses is a Fail. Use judgment proportional to downstream impact.
- **Don't rewrite.** The review identifies problems; the user decides how to fix them. Offer suggestions but don't produce corrected artifacts.
