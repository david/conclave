---
name: develop
description: >
  Disciplined software development with strict TDD (red-green-refactor), KISS, DRY, and YAGNI.
  Use when the user asks to implement a feature, fix a bug, build something, add functionality,
  or any task that produces behavioral code changes. Triggers on: "implement X", "build X",
  "add feature X", "fix bug X", "/develop", or when entering a development/coding mode.
  Does NOT trigger for purely structural changes (renames, formatting, moves) that have no
  behavioral impact. For spec-driven work, use the organize/orchestrate pipeline instead.
---

# Dev

Disciplined development workflow enforcing TDD red-green-refactor, KISS, DRY, and YAGNI.

## Principles

- **TDD (Red-Green-Refactor)**: Write a failing test first, make it pass with minimal code, then refactor. Never skip red.
- **KISS**: Prefer the simplest solution that works. Fewer abstractions, less indirection.
- **DRY**: Extract duplication only when a pattern repeats 3+ times. Premature abstraction is worse than duplication.
- **YAGNI**: Only build what is needed now. No speculative features, config options, or "just in case" code.
- **Small atomic commits**: Each commit should be a single logical change that passes all tests.

## Workflow

Every behavioral change follows this strict sequence:

### 1. Understand

- Read the relevant existing code and tests before changing anything.
- Identify the minimal scope of the change. Push back on scope creep.

### 2. Red — Write a failing test

- Write one or more tests that describe the desired behavior.
- Run the tests. **Confirm they fail.** If they pass, the test is not testing new behavior — rewrite it.
- Use Arrange-Act-Assert structure:

```
// Arrange — set up preconditions
// Act — execute the behavior under test
// Assert — verify the outcome
```

### 3. Green — Make it pass

- Write the **minimum code** to make the failing test(s) pass. No more.
- Do not refactor yet. Do not add error handling for cases not covered by tests.
- Run the tests. **Confirm they pass.**

### 4. Refactor

- Now improve the code: remove duplication, rename for clarity, simplify.
- Run the tests after each refactoring step. **They must stay green.**
- Apply KISS: if the refactoring adds complexity without clear value, revert it.

### 5. Commit

- Stage only the files related to this change.
- Write a concise commit message: `type(scope): what and why`
- Offer to commit. Do not auto-commit.

### 6. Repeat

- Return to step 1 for the next behavioral change.
- Each cycle should be small — a single behavior, not an entire feature at once.

## Rules

### Test-first is mandatory for behavioral changes

Behavioral changes include: new features, bug fixes, changed logic, new endpoints, modified state transitions.

**Never write implementation code before its test exists and fails.**

If tempted to skip the test, stop and write it. If the test is hard to write, that signals the design needs rethinking.

### Test-first is NOT required for non-behavioral changes

These do not require a preceding failing test:
- Renames, moves, reformats
- Comment or documentation changes
- Dependency updates (unless they change behavior)
- Config changes with no logic
- Deleting dead code

### Keep cycles small

One failing test → one passing implementation → one refactor. Not ten.

If a feature needs many tests, implement them one at a time, each through a full red-green-refactor cycle.

### No speculative code

- No feature flags for uncommitted features
- No "extensible" abstractions for one use case
- No error handling for impossible states
- No backwards-compatibility shims — change the code directly
- Three similar lines are better than a premature abstraction

### Commit discipline

- Each commit is one logical change that passes all tests
- Never commit failing tests (except as a deliberate WIP with clear intent)
- Prefer specific `git add <file>` over `git add .`
