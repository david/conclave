# conclave:tasks

A machine-readable task graph used by the organizer and orchestrator skills. Written to `.conclave/specs/<name>/implementation.json` as a raw JSON file. It exists as structured data that the orchestrator parses to coordinate parallel agent execution.

## Schema

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

## Fields

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

## Emission Rules

- Emitted as a single JSON array (not one block per task).
- Written to `.conclave/specs/<name>/implementation.json` as a raw JSON file (no markdown wrapper, no `conclave:tasks` fenced block).
- The JSON file is the sole machine-readable source of truth.
