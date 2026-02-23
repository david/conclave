# Organizer — Review Checklist

Criteria for evaluating `tasks.md`.

## Structure

1. **Has an opening summary.** A one-sentence summary of the parallelization strategy.
2. **Has a Task Graph block.** A `conclave:tasks` fenced code block containing a JSON array.
3. **JSON is valid.** The task array parses as well-formed JSON.
4. **Has Wave sections.** Markdown `## Wave N` sections with expanded task descriptions below the JSON block.

## Task Completeness

5. **Every UC is covered.** Each UC ID from implementation.md appears in at least one task's `ucs` array.
6. **No orphan tasks.** Every task references at least one UC (or is a structural prerequisite like "New Types").
7. **Task IDs are sequential.** Format: `T-0`, `T-1`, etc., with no gaps.
8. **Each task has required fields.** `id`, `name`, `ucs`, `depends`, `wave`, `kind`, `files`, `description` are all present.

## TDD Ordering

9. **Tests precede implementation.** For every code task with tests, the test task (Red) is in an earlier wave than the implementation task (Green).
10. **Red-Green naming.** Task names use "Red: ..." and "Green: ..." prefixes when the TDD cycle is the primary structure.
11. **Red tests are meaningful.** Test tasks should fail for the *right reason* (missing behavior), not for structural reasons (file not found, import error). If a test imports a file that doesn't exist yet, the file's creation must be in an earlier wave.
12. **Green tasks reference their tests.** Implementation task descriptions explicitly state to run the corresponding Red tests and confirm they pass.

## Dependency Graph

13. **Dependencies are valid.** Every ID in a task's `depends` array exists as another task's `id`.
14. **No circular dependencies.** The dependency graph is a DAG.
15. **File mutation conflicts are resolved.** Two tasks that modify the same file are not in the same wave (unless explicitly noted as safe).
16. **Create-before-modify ordering.** If task A creates a file and task B modifies it, B depends on A.
17. **New Types is a prerequisite.** If a "New Types" task exists, all tasks that reference those types depend on it.

## Wave Assignment

18. **Wave 0 has no dependencies.** All tasks in wave 0 have an empty `depends` array.
19. **Wave N dependencies are in waves < N.** No task depends on a task in the same or later wave.
20. **Parallelism is maximized.** Tasks are not needlessly serialized — if two tasks have no dependency relationship, they should be in the same wave when possible.
21. **Waves are contiguous.** No skipped wave numbers (wave 0, 1, 3 with no wave 2).

## Task Descriptions

22. **Markdown sections have enough context.** Each task's expanded markdown section includes files, steps, and test scenarios sufficient for an agent to execute without reading implementation.md.
23. **No lost detail.** The planner's step details and test scenarios are preserved in the task descriptions — not summarized away.
24. **Kind is appropriate.** `"code"` for tasks that produce behavioral changes, `"convention"` for documentation-only or no-op tasks.

## Calibration

25. **Proportional to scope.** A 3-UC spec shouldn't produce 15 tasks. Splitting is justified by enabling parallelism, not by granularity for its own sake.
26. **No premature splitting.** Tasks are only split if the substeps are genuinely independent and splitting enables more parallelism.
