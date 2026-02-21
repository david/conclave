# Unified Skills Directory

Conclave skills live in `.conclave/skills/` as the canonical location. On startup, Conclave auto-manages symlinks in `.claude/skills/` so Claude Code can discover and invoke them natively. Conclave does not inject skill content into prompts — Claude Code handles that.

## Use Cases

```conclave:usecase
{
  "id": "UC-1",
  "name": "Auto-create symlinks for Conclave skills",
  "actor": "System",
  "summary": "On startup, Conclave scans .conclave/skills/ and creates corresponding symlinks in .claude/skills/ so Claude Code can discover them.",
  "given": [
    "One or more skill directories exist under `.conclave/skills/` (each containing a `SKILL.md`)"
  ],
  "when": [
    "Conclave starts up"
  ],
  "then": [
    "If `.claude/skills/` does not exist, it is created",
    "For each directory in `.conclave/skills/<name>`, a symlink `.claude/skills/<name>` is created pointing to the corresponding `.conclave/skills/<name>`",
    "Existing correct symlinks are left unchanged",
    "Claude Code can discover and load skills via `.claude/skills/<name>/SKILL.md`"
  ],
  "priority": "high"
}
```

```conclave:usecase
{
  "id": "UC-2",
  "name": "Remove stale skill symlinks",
  "actor": "System",
  "summary": "On startup, Conclave removes symlinks in .claude/skills/ that point to .conclave/skills/ directories that no longer exist.",
  "given": [
    "A symlink exists at `.claude/skills/<name>` pointing into `.conclave/skills/`",
    "The target `.conclave/skills/<name>` no longer exists"
  ],
  "when": [
    "Conclave starts up"
  ],
  "then": [
    "The stale symlink is removed from `.claude/skills/`",
    "Symlinks that point to targets outside `.conclave/skills/` are left untouched"
  ],
  "priority": "high"
}
```

```conclave:usecase
{
  "id": "UC-3",
  "name": "Skip conflicting entries",
  "actor": "System",
  "summary": "When a non-symlink or a symlink pointing outside .conclave/skills/ already exists at .claude/skills/<name>, Conclave skips it and logs a warning.",
  "given": [
    "A skill directory exists at `.conclave/skills/<name>`",
    "An entry already exists at `.claude/skills/<name>` that is either a real file/directory or a symlink pointing outside `.conclave/skills/`"
  ],
  "when": [
    "Conclave starts up and attempts to create the symlink"
  ],
  "then": [
    "The existing entry is left untouched",
    "A warning is logged identifying the conflict and its type",
    "Other non-conflicting symlinks are still created normally"
  ],
  "priority": "medium",
  "dependencies": ["UC-1"]
}
```

```conclave:usecase
{
  "id": "UC-4",
  "name": "Migrate existing skills to .conclave/skills/",
  "actor": "Developer",
  "summary": "Move the req skill from its current location into .conclave/skills/ so it is managed by the auto-symlink system.",
  "given": [
    "The req skill exists at `~/.claude/skills/req/SKILL.md`"
  ],
  "when": [
    "The developer moves the skill directory to `.conclave/skills/req/`",
    "The developer removes the old directory from `~/.claude/skills/`"
  ],
  "then": [
    "The skill lives at `.conclave/skills/req/SKILL.md`",
    "On next startup, Conclave auto-creates the symlink at `.claude/skills/req`",
    "Claude Code continues to discover and invoke the skill"
  ],
  "priority": "medium",
  "dependencies": ["UC-1"]
}
```
