# conclave:usecase

Renders structured use cases as interactive cards in the chat and workspace panes. Each block contains a single JSON object describing one use case.

## Schema

The canonical schema is defined in the **skills** repo at `skills/use-cases/references/usecases.schema.json`. See that file for types, required fields, and constraints.

The rendering-relevant fields are:

| Field          | Type       | Description                                              |
|----------------|------------|----------------------------------------------------------|
| `id`           | string     | Unique identifier (`UC-1`, `UC-2`, etc.).                |
| `name`         | string     | Short action-oriented name for the use case.             |
| `actor`        | string     | Who performs the action (e.g. `"End User"`, `"System"`). |
| `summary`      | string     | One-sentence description of the use case.                |
| `given`        | string[]   | Preconditions (Given clauses).                           |
| `when`         | string[]   | Trigger actions (When clauses).                          |
| `then`         | string[]   | Expected outcomes (Then clauses).                        |
| `priority`     | string     | One of `"high"`, `"medium"`, or `"low"`.                 |
| `dependencies` | string[]   | IDs of use cases that must be completed first.           |
| `edgeCases`    | string[]   | Key edge cases — most likely and most damaging.          |

## Example

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
  "priority": "high",
  "edgeCases": ["User rapidly clicks the button twice"]
}
```
````

## Rendering

The UI renders each block as a card showing the ID and priority badge at the top, the name, actor, a Given/When/Then scenario breakdown, and any dependency links at the bottom. Cards are color-coded by priority (high = blue, medium = amber, low = default).

## Emission Rules

- One block per use case — emit separate blocks, not a JSON array. This allows cards to stream incrementally.
- For multiple use cases, emit blocks one after another.
- Invalid JSON falls back to a standard code block.
