# Unified Skills Directory

Conclave skills should live in `.conclave/skills/` as the canonical location, with symlinks into `.claude/skills/` so both the inner ACP agent and the outer Claude Code agent can consume them.

## Use Cases

### UC-1: Resolve Conclave mode skills from .conclave/skills/ (High)
- **Actor:** System
- **Summary:** The mode loader resolves skill paths relative to `.conclave/skills/` so modes can reference project-local skills.
- **Given:** A mode's frontmatter declares `skills: requirements-analyst`
- **When:** The mode loader resolves skill files
- **Then:**
  - The loader reads `.conclave/skills/requirements-analyst/SKILL.md`
  - The skill content is appended to prompts sent to the ACP subprocess

### UC-2: Symlink skills into .claude/skills/ (High)
- **Actor:** Developer
- **Summary:** Each skill in `.conclave/skills/` has a corresponding symlink in `.claude/skills/` so Claude Code can also discover and invoke it.
- **Given:** A skill exists at `.conclave/skills/<name>/SKILL.md`
- **When:** The developer sets up the project (or a setup script runs)
- **Then:**
  - `.claude/skills/<name>` is a symlink pointing to `../../.conclave/skills/<name>`
  - Claude Code's skill loader follows the symlink and loads the skill
  - Both agents read from a single source of truth

### UC-3: Migrate existing skills to .conclave/skills/ (Medium, depends on UC-1)
- **Actor:** Developer
- **Summary:** Move the requirements-analyst skill from its current home into the project-local `.conclave/skills/` directory.
- **Given:** The requirements-analyst skill exists at `~/.claude/skills/requirements-analyst/SKILL.md`
- **When:** The developer migrates the skill
- **Then:**
  - The skill file moves to `.conclave/skills/requirements-analyst/SKILL.md`
  - The requirements mode's `skills:` frontmatter is updated to reference the new path
  - A symlink is created at `.claude/skills/requirements-analyst` pointing to the conclave location

### UC-4: Update mode skill path resolution (Medium, depends on UC-1)
- **Actor:** System
- **Summary:** The mode loader's skill resolution supports looking up skills by name from `.conclave/skills/<name>/SKILL.md` in addition to arbitrary file paths.
- **Given:** A mode declares `skills: requirements-analyst` (a bare name, not a file path)
- **When:** The mode loader resolves skills
- **Then:**
  - The loader checks `.conclave/skills/<name>/SKILL.md` relative to cwd
  - If found, the skill content is loaded
  - Existing file-path-based resolution continues to work as a fallback
