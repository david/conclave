---
name: orc
description: >
  Execute a spec's task plan by orchestrating parallel agent teams. Reads tasks.md (produced
  by the organizer skill), spawns agents via the Task tool respecting dependency waves, monitors
  progress, and coordinates commits. Use when a spec has a tasks.md and is ready for parallel
  implementation. Triggers on: "orchestrate...", "execute tasks for...", "run the swarm",
  "/orc", "/orc <spec-name>", or when a spec has tasks.md and the user wants to begin
  multi-agent execution.
---

# Orchestrator

Execute a parallelization-aware task plan using agent teams.

## Purpose

Read a spec's `tasks.md`, spawn agents for each task respecting dependency waves, monitor progress, and coordinate integration. Agents follow the dev skill's TDD discipline.

## Workflow

### 1. Locate and Parse

Read `.conclave/specs/<spec-name>/tasks.md`. Parse the `conclave:tasks` JSON block to get the task graph. Also read the human-readable wave sections — these contain the full agent prompts.

If tasks.md is missing, tell the user to run the organizer first (`/org <spec-name>`).

### 2. Load Context

Read the project's `CLAUDE.md` and `.conclave/specs/<spec-name>/implementation.md`. These provide architectural context that agents need.

### 3. Execute Waves

Process waves sequentially (wave 0, then wave 1, etc.). Within each wave, launch all tasks in parallel using the Task tool.

#### For each task in a wave:

Skip tasks with `kind: "no-op"` or `kind: "convention"`. Mark them complete.

For `kind: "code"` tasks, launch an agent using the Task tool:

```
Task tool parameters:
  subagent_type: "general-purpose"
  description: "<T-id>: <task name>"
  prompt: <constructed prompt — see Agent Prompt Construction>
```

**Run wave tasks in parallel**: Issue all Task tool calls for a wave in a single message so they execute concurrently.

**Run waves sequentially**: Wait for all tasks in wave N to complete before starting wave N+1.

#### Agent Prompt Construction

Each agent prompt must be self-contained. Include:

1. **Role**: "You are implementing a task as part of a larger spec. Follow strict TDD: write a failing test first, make it pass with minimum code, then refactor. Keep cycles small."

2. **Project context**: Key sections from CLAUDE.md — commands (`bun test`, `bun run check`), architecture overview, key conventions. Keep it concise — only what the agent needs.

3. **Task scope**: The full markdown section for this task from tasks.md, including:
   - Files to create/modify
   - Implementation steps
   - Test scenarios

4. **TDD workflow** (from dev skill):
   ```
   For each test scenario:
   a. Read relevant existing code
   b. Write a failing test (Arrange-Act-Assert)
   c. Run `bun test <test-file>` — confirm it FAILS
   d. Write minimum code to pass
   e. Run `bun test <test-file>` — confirm it PASSES
   f. Run `bun test` — confirm nothing else broke
   g. Refactor if needed, keeping tests green
   ```

5. **Boundaries**: "Only touch the files listed in your task scope. Do not modify files outside your scope — other agents may be working on them concurrently. Do NOT commit — the orchestrator handles commits."

6. **Completion signal**: "When done, report: which files you created/modified, which tests pass, and any issues encountered."

### 4. Monitor and Collect Results

As agents complete, collect their results. Track:
- Which tasks succeeded
- Which tasks had issues (test failures, unexpected problems)
- Files created/modified by each agent

If an agent reports failure:
- Log the failure and continue with other tasks in the wave
- After the wave completes, assess whether dependent tasks in later waves can proceed or if the failure blocks them
- Report blocked tasks to the user and ask how to proceed

### 5. Integration Check

After each wave completes:

1. Run `bun test` to verify all tests pass together (agents tested in isolation — integration may surface conflicts).
2. Run `bun run check` for type checking.
3. If either fails:
   - Identify the conflict (likely a file modified by multiple tasks, or a type mismatch).
   - Report the issue to the user.
   - Offer to fix it directly or spawn a repair agent.

### 6. Commit Strategy

After each wave's integration check passes:

1. Review all files changed in this wave.
2. Propose a commit grouping to the user. Default: one commit per wave with a summary message listing the UCs completed.
3. Wait for user approval before committing.
4. Use specific `git add <file>` (not `git add .`).
5. Commit message format:
   ```
   feat(<spec-name>): <wave summary>

   Implements: <UC-list>

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```

Alternatively, if the user prefers more granular commits, offer one commit per task.

### 7. Progress Reporting

After each wave, report:
- Tasks completed in this wave
- Remaining waves and task count
- Any issues or blocked tasks
- Current test/typecheck status

After all waves complete, report:
- Total tasks executed
- All UCs implemented
- Final test and typecheck status
- Offer to run any additional verification

## Error Recovery

- **Agent timeout**: If an agent doesn't complete within a reasonable time, check its output. Report to user.
- **Test failures in integration**: Spawn a repair agent with context about the failing tests and the files from the conflicting tasks.
- **Blocked dependency chain**: If a task fails and blocks downstream tasks, report the full chain of blocked tasks. Ask user whether to skip, retry, or fix manually.

## Anti-Patterns

- **Don't skip TDD in agent prompts**: Even under parallel execution pressure, agents must test first.
- **Don't let agents commit**: Only the orchestrator (with user approval) commits.
- **Don't ignore integration checks**: Individual agent tests passing doesn't guarantee they work together.
- **Don't run dependent tasks early**: Wait for the full wave to complete and integration to pass before starting the next wave.
