---
name: commit
description: >
  Create a conventional-commits-compliant git commit from staged or unstaged changes.
  Reviews the diff, composes a well-structured commit message following the Conventional Commits
  1.0.0 spec, and commits. Use as a standalone skill or as an agent delegated by the orchestrator.
  Triggers on: "commit this", "commit these changes", "/commit", or when another skill delegates
  a commit task.
---

# Committer

Create clean, conventional-commits-compliant git commits.

## Purpose

Review the current working tree changes, compose a commit message that follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification, and commit. Designed to be lightweight — usable standalone via `/commit` or as a delegated agent from the orchestrator.

## Conventional Commits Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use                                    |
|------------|------------------------------------------------|
| `feat`     | New feature or capability                      |
| `fix`      | Bug fix                                        |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or updating tests only                  |
| `docs`     | Documentation only                             |
| `chore`    | Build, tooling, config, or maintenance         |
| `perf`     | Performance improvement                        |
| `style`    | Formatting, whitespace — no logic change       |
| `ci`       | CI/CD configuration                            |
| `build`    | Build system or external dependency changes    |

### Rules

- **Scope** is a noun in parentheses describing the area of change — e.g., `feat(auth):`, `fix(parser):`.
- **Description** is imperative, lowercase, no trailing period — e.g., `add session timeout handling`.
- **Body** explains *what* and *why*, not *how*. Wrap at 72 characters. Separate from description with a blank line.
- **Breaking changes**: Add `!` before the colon — `feat(api)!: remove deprecated endpoint` — and/or a `BREAKING CHANGE:` footer.
- **Footer**: Use `token: value` or `token #value` format. Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.

## Workflow

### 1. Assess Changes

Run `git status` and `git diff` (staged and unstaged) to understand what changed.

If there are no changes to commit, report that and stop.

### 2. Stage Files

- Use specific `git add <file>` for each changed file — never `git add .` or `git add -A`.
- If called with explicit file list (e.g., from orchestrator context), stage exactly those files.
- Otherwise, stage all modified and new files found in the diff.
- Never stage files that look like they contain secrets (`.env`, credentials, tokens).

### 3. Compose Commit Message

Analyze the staged diff to determine:

- **Type**: Pick the most accurate type from the table above. If changes span multiple types, use the dominant one.
- **Scope**: Infer from the file paths or module names. Use the spec name when working within a spec context. Omit if changes are too broad for a single noun.
- **Description**: Concise imperative summary of the change.
- **Body** (if needed): Include when the diff is non-trivial — explain the motivation or design choice. Not needed for small, obvious changes.
- **Footers**: Always include `Co-Authored-By`. Add `Implements: <UC-list>` when context provides UC identifiers.

### 4. Commit

Commit using a heredoc for proper formatting:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<body>

<footers>
EOF
)"
```

### 5. Confirm

Run `git log --oneline -1` to verify the commit was created. Report the short SHA and message.

## When Called by the Orchestrator

The orchestrator provides context as part of the agent prompt:

- **Spec name** — use as scope
- **Wave summary** — use to compose the description
- **UC list** — include in `Implements:` footer
- **File list** — stage exactly these files
- **Type hint** — from `spec.json`'s `type` field (use if provided, otherwise infer)

Follow the same workflow above, but use the provided context instead of inferring everything from the diff.
