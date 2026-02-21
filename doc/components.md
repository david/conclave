# Conclave Markdown Blocks

Conclave extends standard markdown rendering with custom fenced code blocks that use the `conclave:` language prefix. When Claude's response contains these blocks, the chat UI renders them as rich interactive components instead of plain code.

## `conclave:usecase`

Renders structured use cases as cards in the chat and workspace panes. Each block contains a single JSON object describing one use case.

### Schema

```json
{
  "id": "UC-1",
  "name": "Short descriptive name",
  "actor": "End User",
  "summary": "One-sentence description of what the actor accomplishes.",
  "given": ["precondition A", "precondition B"],
  "when": ["action the actor takes"],
  "then": ["expected outcome A", "expected outcome B"],
  "priority": "high",
  "dependencies": ["UC-0"]
}
```

| Field          | Type       | Required | Description                                              |
|----------------|------------|----------|----------------------------------------------------------|
| `id`           | string     | yes      | Unique identifier, typically `UC-1`, `UC-2`, etc.        |
| `name`         | string     | yes      | Short action-oriented name for the use case.             |
| `actor`        | string     | yes      | Who performs the action (e.g. `"End User"`, `"System"`). |
| `summary`      | string     | yes      | One-sentence description of the use case.                |
| `given`        | string[]   | yes      | Preconditions (Given clauses).                           |
| `when`         | string[]   | yes      | Trigger actions (When clauses).                          |
| `then`         | string[]   | yes      | Expected outcomes (Then clauses).                        |
| `priority`     | string     | yes      | One of `"high"`, `"medium"`, or `"low"`.                 |
| `dependencies` | string[]   | no       | IDs of use cases that must be completed first.           |

### Example

````
```conclave:usecase
{
  "id": "UC-1",
  "name": "Create new session",
  "actor": "End User",
  "summary": "User creates a fresh Claude Code session from the chat interface.",
  "given": ["The server is running", "At least one session exists"],
  "when": ["The user clicks the new session button"],
  "then": ["A new ACP session is created", "The chat switches to the new session"],
  "priority": "high"
}
```
````

The UI renders this as a card showing the ID and priority badge at the top, the name, actor, a Given/When/Then scenario breakdown, and any dependency links at the bottom. Cards are color-coded by priority (high = blue, medium = amber, low = default).

### Usage

The `requirements-analyst` skill emits one block per use case. Emitting them separately (rather than as a JSON array) allows cards to appear incrementally in the UI as they stream in.

## `conclave:tasks`

A machine-readable task graph used by the organizer and orchestrator skills. This block is **not rendered specially** in the UI — it appears as a standard code block. It exists as a structured data format that the orchestrator parses to coordinate parallel agent execution.

### Schema

```json
[
  {
    "id": "T-0",
    "name": "Short task name",
    "ucs": ["UC-1", "UC-2"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": ["server/new-file.ts"],
      "modify": ["server/types.ts"]
    },
    "description": "What this task accomplishes."
  }
]
```

| Field         | Type     | Required | Description                                                                 |
|---------------|----------|----------|-----------------------------------------------------------------------------|
| `id`          | string   | yes      | Sequential identifier: `T-0`, `T-1`, etc.                                  |
| `name`        | string   | yes      | Short action-oriented name.                                                 |
| `ucs`         | string[] | yes      | UC IDs this task implements.                                                |
| `depends`     | string[] | yes      | Task IDs that must complete first (empty = no dependencies).                |
| `wave`        | number   | yes      | Execution wave (0 = first). Tasks in the same wave run in parallel.         |
| `kind`        | string   | yes      | One of `"code"`, `"convention"` (docs/skill only), or `"no-op"` (covered elsewhere). |
| `files.create`| string[] | yes      | Files this task creates.                                                    |
| `files.modify`| string[] | yes      | Files this task modifies.                                                   |
| `description` | string   | yes      | Enough context for an agent to understand the task's scope.                 |

### Usage

The `organizer` skill writes a `conclave:tasks` block into `.conclave/specs/<name>/tasks.md`. The `orchestrator` skill reads it to determine which tasks can run concurrently and spawns agents accordingly.
