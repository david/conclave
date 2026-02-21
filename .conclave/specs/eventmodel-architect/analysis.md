# Event Model Architect Integration

Update the architect skill to emit `conclave:eventmodel` blocks instead of markdown event model sections. See parent epic (`event-model-diagram`) for shared decisions and schema.

## Use Cases

### UC-1: Architect emits event model blocks (high)
- **Actor:** System
- **Summary:** The architect skill outputs event models as conclave:eventmodel blocks, one per slice, replacing the previous markdown format.
- **Given:** The architect skill has analyzed a spec's use cases and determined the event model.
- **When:** The skill writes event model output.
- **Then:**
  - Each slice is emitted as a separate conclave:eventmodel fenced code block in chat
  - The same blocks are written into analysis.md, replacing the markdown Event Model sections
  - Cross-slice relationships are expressed via feeds arrays
  - The architect skill no longer writes the markdown Command/Events/Projections/Side Effects format

```conclave:usecase
{
  "id": "UC-1",
  "name": "Architect emits event model blocks",
  "actor": "System",
  "summary": "The architect skill outputs event models as conclave:eventmodel blocks, one per slice, replacing the previous markdown format.",
  "given": [
    "The architect skill has analyzed a spec's use cases and determined the event model"
  ],
  "when": [
    "The skill writes event model output"
  ],
  "then": [
    "Each slice is emitted as a separate conclave:eventmodel fenced code block in chat",
    "The same blocks are written into analysis.md, replacing the markdown Event Model sections",
    "Cross-slice relationships are expressed via feeds arrays",
    "The architect skill no longer writes the markdown Command/Events/Projections/Side Effects format"
  ],
  "priority": "high"
}
```
