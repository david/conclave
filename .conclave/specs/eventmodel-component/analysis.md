# Event Model Component

React component that renders `conclave:eventmodel` JSON blocks as vertical event model diagrams in the chat pane. See parent epic (`event-model-diagram`) for shared decisions and schema.

## Use Cases

### UC-1: View event model diagram in chat (high)
- **Actor:** End User
- **Summary:** When an assistant message contains conclave:eventmodel blocks, the user sees a visual diagram with slice columns and tier-aligned nodes instead of raw JSON.
- **Given:** An assistant message contains one or more conclave:eventmodel fenced code blocks.
- **When:** The message is rendered in the chat pane.
- **Then:**
  - Each slice appears as a labeled column in a single diagram
  - Nodes are positioned at their tier row within the slice column
  - Within-slice arrows connect adjacent tiers top to bottom
  - Multiple slices are laid out as columns on a shared grid with aligned tier rows

```conclave:usecase
{
  "id": "UC-1",
  "name": "View event model diagram in chat",
  "actor": "End User",
  "summary": "When an assistant message contains conclave:eventmodel blocks, the user sees a visual diagram with slice columns and tier-aligned nodes instead of raw JSON.",
  "given": [
    "An assistant message contains one or more conclave:eventmodel fenced code blocks"
  ],
  "when": [
    "The message is rendered in the chat pane"
  ],
  "then": [
    "Each slice appears as a labeled column in a single diagram",
    "Nodes are positioned at their tier row within the slice column",
    "Within-slice arrows connect adjacent tiers top to bottom",
    "Multiple slices are laid out as columns on a shared grid with aligned tier rows"
  ],
  "priority": "high"
}
```

### UC-2: Trace cross-slice relationships (high, depends on UC-1)
- **Actor:** End User
- **Summary:** When nodes in different slices are connected via feeds, the user sees arrows crossing between slice columns.
- **Given:** A node in one slice has a feeds reference to a node in another slice, and both slices are rendered.
- **When:** The user views the diagram.
- **Then:**
  - An arrow is drawn from the source node to the target node across slice columns
  - Cross-slice arrows are visually distinct from within-slice flow arrows

```conclave:usecase
{
  "id": "UC-2",
  "name": "Trace cross-slice relationships",
  "actor": "End User",
  "summary": "When nodes in different slices are connected via feeds, the user sees arrows crossing between slice columns to trace how data flows across boundaries.",
  "given": [
    "A node in one slice has a feeds reference to a node in another slice",
    "Both slices are rendered in the diagram"
  ],
  "when": [
    "The user views the diagram"
  ],
  "then": [
    "An arrow is drawn from the source node to the target node across slice columns",
    "Cross-slice arrows are visually distinct from within-slice flow arrows"
  ],
  "priority": "high",
  "dependencies": ["UC-1"]
}
```

### UC-3: Inspect node fields (medium, depends on UC-1)
- **Actor:** End User
- **Summary:** The user can expand a node to see its field definitions and collapse it again.
- **Given:** A node in the diagram has fields defined.
- **When:** The user clicks the node.
- **Then:**
  - The node expands to reveal its field key:type pairs
  - Clicking again collapses the fields
  - Nodes without fields are not expandable

```conclave:usecase
{
  "id": "UC-3",
  "name": "Inspect node fields",
  "actor": "End User",
  "summary": "The user can expand a node to see its field definitions (key:type pairs) and collapse it again.",
  "given": [
    "A node in the diagram has fields defined"
  ],
  "when": [
    "The user clicks the node"
  ],
  "then": [
    "The node expands to reveal its field key:type pairs",
    "Clicking again collapses the fields",
    "Nodes without fields are not expandable"
  ],
  "priority": "medium",
  "dependencies": ["UC-1"]
}
```

### UC-4: Graceful fallback for invalid blocks (medium)
- **Actor:** End User
- **Summary:** Invalid conclave:eventmodel blocks render as plain code blocks rather than breaking the UI.
- **Given:** An assistant message contains a conclave:eventmodel block with invalid content.
- **When:** The message is rendered.
- **Then:**
  - The block renders as a standard fenced code block
  - No error is thrown and other content in the message renders normally

```conclave:usecase
{
  "id": "UC-4",
  "name": "Graceful fallback for invalid blocks",
  "actor": "End User",
  "summary": "If a conclave:eventmodel block contains invalid JSON or is missing the required slice field, it renders as a plain code block rather than breaking the UI.",
  "given": [
    "An assistant message contains a conclave:eventmodel block with invalid content"
  ],
  "when": [
    "The message is rendered"
  ],
  "then": [
    "The block renders as a standard fenced code block",
    "No error is thrown and other content in the message renders normally"
  ],
  "priority": "medium"
}
```
