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

## `conclave:eventmodel`

Renders an event-model diagram showing the flow from screens through commands, events, and projections to side effects. Each block describes one vertical slice. Multiple blocks in the same assistant message are collected and rendered together as a single multi-column diagram below the markdown content.

### Schema

```json
{
  "slice": "create-session",
  "label": "Create Session",
  "screen": "Session Picker",
  "command": {
    "name": "CreateSession",
    "new": true,
    "fields": { "title": "string" },
    "feeds": ["SessionList"]
  },
  "events": [
    {
      "name": "SessionCreated",
      "new": false,
      "fields": { "sessionId": "string", "title": "string" },
      "feeds": ["SessionRegistry"]
    }
  ],
  "projections": [
    {
      "name": "SessionRegistry",
      "new": false,
      "fields": { "sessions": "Map<string, SessionMeta>" }
    }
  ],
  "sideEffects": ["Broadcast session list to all connected clients"]
}
```

| Field            | Type              | Required | Description                                                                 |
|------------------|-------------------|----------|-----------------------------------------------------------------------------|
| `slice`          | string            | yes      | Kebab-case identifier for the event slice.                                  |
| `label`          | string            | no       | Human-readable label for the slice column header. Falls back to `slice`.    |
| `screen`         | string            | no       | UI screen or view that initiates this slice's command.                      |
| `command`        | object            | no       | The command node for this slice.                                            |
| `command.name`   | string            | yes      | Command name.                                                               |
| `command.new`    | boolean           | no       | Whether this is a newly introduced command.                                 |
| `command.fields` | Record<string,string> | no  | Key-value pairs of field name to type.                                      |
| `command.feeds`  | string[]          | no       | Names of nodes in other slices that this command feeds into.                |
| `events`         | object[]          | no       | Domain events emitted by this slice.                                        |
| `events[].name`  | string            | yes      | Event name.                                                                 |
| `events[].new`   | boolean           | no       | Whether this is a newly introduced event.                                   |
| `events[].fields`| Record<string,string> | no  | Key-value pairs of field name to type.                                      |
| `events[].feeds` | string[]          | no       | Names of nodes in other slices that this event feeds into.                  |
| `projections`    | object[]          | no       | Read-model projections in this slice.                                       |
| `projections[].name`   | string       | yes      | Projection name.                                                            |
| `projections[].new`    | boolean       | no       | Whether this is a newly introduced projection.                              |
| `projections[].fields` | Record<string,string> | no | Key-value pairs of field name to type.                                    |
| `projections[].feeds`  | string[]      | no       | Names of nodes in other slices that this projection feeds into.             |
| `sideEffects`    | string[]          | no       | Free-text descriptions of side effects triggered by this slice.             |

### Rendering Behavior

- Each `conclave:eventmodel` block represents one slice.
- Multiple blocks in the same message are collected and rendered as a single multi-column diagram below the markdown content.
- The diagram has a tier-labels gutter on the left and slice columns on the right (horizontally scrollable).
- Five fixed tiers are laid out top-to-bottom: Screen, Command, Events, Projections, Side Effects.
- Nodes are color-coded by tier: command = blue, event = orange, projection = gray, side effect = green, screen = neutral.
- Nodes with `new: true` get a small indicator dot to highlight newly introduced elements.
- Within-slice arrows connect adjacent populated tiers from top to bottom.
- Cross-slice arrows (dashed SVG paths) connect nodes via `feeds` references, showing data flow between slices.
- Nodes with `fields` are expandable on click to show key:type pairs.
- Invalid blocks (bad JSON or missing `slice` field) fall back to standard code block rendering.

### Example

````
```conclave:eventmodel
{
  "slice": "create-session",
  "label": "Create Session",
  "screen": "Session Picker",
  "command": {
    "name": "CreateSession",
    "new": true,
    "fields": { "title": "string" },
    "feeds": ["SessionList"]
  },
  "events": [
    {
      "name": "SessionCreated",
      "new": false,
      "fields": { "sessionId": "string", "title": "string" },
      "feeds": ["SessionRegistry"]
    }
  ],
  "projections": [
    {
      "name": "SessionRegistry",
      "new": false,
      "fields": { "sessions": "Map<string, SessionMeta>" }
    }
  ],
  "sideEffects": ["Broadcast session list to all connected clients"]
}
```
````

### Usage

The `architect` skill emits one block per event slice. Multiple blocks in a single message form a unified multi-column diagram.
