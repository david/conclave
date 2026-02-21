# Event Model Diagram

Visual rendering of event-sourced slices as vertical diagrams in the chat UI. Each slice is a `conclave:eventmodel` fenced code block containing JSON. Multiple blocks in the same assistant message form a single multi-column diagram. Replaces the previous markdown-based event model format used by the architect skill.

## Decisions

- **Block format**: One `conclave:eventmodel` fenced code block per slice, containing JSON. Multiple blocks in the same assistant message form a single diagram.
- **Tier order**: Fixed vertical layout top to bottom: screen, command, events, projections, side effects. Not configurable.
- **Node colors**: Screen: neutral/white. Command: blue. Event: orange. Projection: gray with gear icon. Side effect: green. Follows event storming conventions.
- **`new` flag**: Commands, events, and projections support an optional `new: boolean` to distinguish new types from existing ones. Rendered as a subtle visual indicator.
- **`fields` on nodes**: Commands, events, and projections support an optional `fields` object of `{ key: type }` pairs. Collapsed by default, expandable on click.
- **`feeds` for cross-slice arrows**: Commands, events, and projections support an optional `feeds` string array naming target nodes in other slices. Arrows are drawn across slice columns. Side effects don't support `feeds` — they are leaf nodes.
- **Within-slice arrows**: Implicit. Arrows flow downward between adjacent populated tiers. No explicit edge declarations needed.
- **Cross-slice arrow resolution**: Reactive. Arrows are drawn when both source and target slices are present. Unresolved references are silently ignored.
- **Zero-command slices**: Valid. A slice can be purely reactive (e.g. a projection listening to events from other slices with no command or screen).
- **Horizontal layout**: Slices are columns, ordered left to right by emission order. Tier rows are aligned across columns. Horizontal scroll if slices exceed available width.
- **Invalid JSON fallback**: Blocks with invalid JSON or missing required `slice` field render as plain code blocks.
- **Event model format in analysis.md**: `conclave:eventmodel` blocks replace the previous markdown `#### Event Model` sections. The blocks are the canonical event model representation. Both the chat renderer (for diagrams) and downstream skills (planner, organizer) consume the same JSON.

## Schema

```json
{
  "slice": "fill-inputs",
  "label": "Fill Inputs",
  "screen": "Input Form",
  "command": {
    "name": "FillInputs",
    "new": true,
    "fields": { "packetSessionId": "UUID", "userId": "UUID", "values": "Custom" },
    "feeds": ["InputFilled"]
  },
  "events": [
    {
      "name": "InputFilled",
      "new": true,
      "fields": { "inputId": "UUID", "value": "Custom", "source": "String | user" },
      "feeds": ["MlsLookup"]
    }
  ],
  "projections": [
    {
      "name": "MlsLookup",
      "new": true,
      "feeds": ["FillMlsInputs"]
    }
  ],
  "sideEffects": [
    "Broadcast InputFilled to session clients"
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `slice` | string | yes | Kebab-case identifier for the slice. |
| `label` | string | no | Display name for the slice column header. Defaults to `slice` if omitted. |
| `screen` | string | no | Screen/UI entry point label. |
| `command` | object | no | The command that triggers this slice. |
| `command.name` | string | yes | Command name (PascalCase). |
| `command.new` | boolean | no | Whether this is a new command type. |
| `command.fields` | object | no | Key-value pairs of field name to type. |
| `command.feeds` | string[] | no | Names of nodes in other slices this connects to. |
| `events` | array | no | Domain events emitted by the command. |
| `events[].name` | string | yes | Event name (PascalCase). |
| `events[].new` | boolean | no | Whether this is a new event type. |
| `events[].fields` | object | no | Key-value pairs of field name to type. |
| `events[].feeds` | string[] | no | Names of nodes in other slices this connects to. |
| `projections` | array | no | Read models / projections that react to the events. |
| `projections[].name` | string | yes | Projection name (PascalCase). |
| `projections[].new` | boolean | no | Whether this is a new projection. |
| `projections[].fields` | object | no | Key-value pairs of field name to type. |
| `projections[].feeds` | string[] | no | Names of nodes in other slices this connects to. |
| `sideEffects` | string[] | no | Descriptions of side effects (WS broadcasts, ACP calls, etc). |
