# Organizer — Review Checklist

Criteria for evaluating `implementation.json`.

## Structure

1. **JSON is valid.** The file parses as a well-formed JSON array of task objects.
2. **Tasks are non-empty.** The array contains at least one task object.

## Task Completeness

3. **Every UC is covered.** Each UC ID from the spec appears in at least one task's `ucs` array.
4. **No orphan tasks.** Every task references at least one UC (or is a structural prerequisite like "New Types").
5. **Task IDs are sequential.** Format: `T-0`, `T-1`, etc., with no gaps.
6. **Each task has required fields.** `id`, `name`, `ucs`, `depends`, `wave`, `kind`, `files`, `description` are all present.

## TDD Ordering

7. **Tests precede implementation.** For every code task with tests, the test task (Red) is in an earlier wave than the implementation task (Green).
8. **Red-Green naming.** Task names use "Red: ..." and "Green: ..." prefixes when the TDD cycle is the primary structure.
9. **Red tests are meaningful.** Test tasks should fail for the *right reason* (missing behavior), not for structural reasons (file not found, import error). If a test imports a file that doesn't exist yet, the file's creation must be in an earlier wave.
10. **Green tasks reference their tests.** Implementation task descriptions explicitly state to run the corresponding Red tests and confirm they pass.

## Dependency Graph

11. **Dependencies are valid.** Every ID in a task's `depends` array exists as another task's `id`.
12. **No circular dependencies.** The dependency graph is a DAG.
13. **File mutation conflicts are resolved.** Two tasks that modify the same file are not in the same wave (unless explicitly noted as safe).
14. **Create-before-modify ordering.** If task A creates a file and task B modifies it, B depends on A.
15. **New Types is a prerequisite.** If a "New Types" task exists, all tasks that reference those types depend on it.

## Wave Assignment

16. **Wave 0 has no dependencies.** All tasks in wave 0 have an empty `depends` array.
17. **Wave N dependencies are in waves < N.** No task depends on a task in the same or later wave.
18. **Parallelism is maximized.** Tasks are not needlessly serialized — if two tasks have no dependency relationship, they should be in the same wave when possible.
19. **Waves are contiguous.** No skipped wave numbers (wave 0, 1, 3 with no wave 2).

## Task Descriptions

20. **Descriptions have enough context.** Each task's `description` field includes files, steps, and test scenarios sufficient for an agent to execute without reading upstream artifacts.
21. **No lost detail.** The planner's step details and test scenarios are preserved in the task descriptions — not summarized away.
22. **Kind is appropriate.** `"code"` for tasks that produce behavioral changes, `"convention"` for documentation-only or no-op tasks.

## Calibration

23. **Proportional to scope.** A 3-UC spec shouldn't produce 15 tasks. Splitting is justified by enabling parallelism, not by granularity for its own sake.
24. **No premature splitting.** Tasks are only split if the substeps are genuinely independent and splitting enables more parallelism.
