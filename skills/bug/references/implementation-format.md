# Bug implementation.md Format

```markdown
# Bug: <Short Title> — Implementation

<One-sentence summary of the fix.>

## Fix

**Files:**
- `path/to/file.ts` — what to change and why

**Steps:**
1. Concrete change (function name, logic to add/remove/modify)
2. ...

## New Tests

**Files:**
- `path/to/file.test.ts` — new or modified test file

**Tests:**
- <Scenario description> → expected outcome
- ...
```

## Guidelines

- Mirror the planner's implementation.md style: concrete file paths, specific function names, numbered steps.
- The "Fix" section covers the minimal code change to resolve the bug. No unrelated cleanup.
- The "New Tests" section describes tests that would have caught the bug (from research.md) plus any regression test for the fix itself.
- Each test entry is a scenario → expectation pair, not test code.
- Keep it buildable — `/org` should be able to decompose this into tasks without ambiguity.
