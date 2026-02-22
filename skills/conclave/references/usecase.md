# conclave:usecase

Renders structured use cases as interactive cards in the chat and workspace panes. Each block contains a single JSON object describing one use case.

## Schema

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

## Fields

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
  "priority": "high"
}
```
````

## Rendering

The UI renders each block as a card showing the ID and priority badge at the top, the name, actor, a Given/When/Then scenario breakdown, and any dependency links at the bottom. Cards are color-coded by priority (high = blue, medium = amber, low = default).

## Emission Rules

- One block per use case — emit separate blocks, not a JSON array. This allows cards to stream incrementally.
- For multiple use cases, emit blocks one after another.
- Invalid JSON falls back to a standard code block.
