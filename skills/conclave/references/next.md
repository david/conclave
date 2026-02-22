# conclave:next

Renders a clickable button that triggers the next phase of a multi-step workflow.

## Schema

```json
{
  "label": "string — Button display text",
  "command": "string — The prompt text to submit when clicked",
  "metaContext": "string — The meta-context name for session grouping (required)"
}
```

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | yes | Button display text |
| command | string | yes | The prompt to submit when clicked |
| metaContext | string | yes | Meta-context name for grouping sessions |

## Rendering

- Valid block with `metaContext` → Renders as a styled button showing the `label` text
- Valid block missing `metaContext` → Renders a muted warning: "Next block missing metaContext"
- Invalid JSON → Falls through to normal code block rendering
