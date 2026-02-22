# conclave:eventmodel

Renders an event-model diagram showing the flow from screens through commands, events, and projections to side effects. Each block describes one vertical slice. Multiple blocks in the same assistant message are collected and rendered together as a single multi-column diagram.

## Schema

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

## Fields

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

## Rendering

- Each block represents one slice column in the diagram.
- Multiple blocks in the same message are collected into a single multi-column diagram below the markdown content.
- Five fixed tiers top-to-bottom: Screen, Command, Events, Projections, Side Effects.
- Nodes are color-coded by tier: command = blue, event = orange, projection = gray, side effect = green, screen = neutral.
- Nodes with `new: true` get a small indicator dot.
- Within-slice arrows connect adjacent populated tiers top to bottom.
- Cross-slice arrows (dashed SVG paths) connect nodes via `feeds` references.
- Nodes with `fields` are expandable on click to show key:type pairs.
- Invalid blocks (bad JSON or missing `slice` field) fall back to standard code block rendering.

## Emission Rules

- One block per slice — emit separate blocks, not a JSON array.
- All tiers are optional — a reactive slice may have only projections.
- Use `feeds` to declare cross-slice connections by target node name.
- If grouped use cases share the same event flow, emit one slice for the group.
- Flag new vs existing via the `new` boolean on commands, events, and projections.
- Name concretely — use actual TypeScript type names (`PromptSubmitted`, not "a prompt event").
