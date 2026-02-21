# Event Model Planner Integration

Update the planner skill to parse `conclave:eventmodel` blocks from analysis.md when producing implementation plans. See parent epic (`event-model-diagram`) for shared decisions and schema.

## Use Cases

### UC-1: Planner reads event model blocks (high)
- **Actor:** System
- **Summary:** The planner skill parses conclave:eventmodel blocks in analysis.md to understand the event architecture when producing an implementation plan.
- **Given:** A spec's analysis.md contains conclave:eventmodel blocks written by the architect skill.
- **When:** The planner skill reads analysis.md to produce implementation.md.
- **Then:**
  - The planner extracts slice names, commands, events, projections, and side effects from the JSON blocks
  - This information informs the implementation plan (which files to create, which types to define, which slices to implement)
  - The planner references slices by name in the implementation steps

```conclave:usecase
{
  "id": "UC-1",
  "name": "Planner reads event model blocks",
  "actor": "System",
  "summary": "The planner skill parses conclave:eventmodel blocks in analysis.md to understand the event architecture when producing an implementation plan.",
  "given": [
    "A spec's analysis.md contains conclave:eventmodel blocks written by the architect skill"
  ],
  "when": [
    "The planner skill reads analysis.md to produce implementation.md"
  ],
  "then": [
    "The planner extracts slice names, commands, events, projections, and side effects from the JSON blocks",
    "This information informs the implementation plan (which files to create, which types to define, which slices to implement)",
    "The planner references slices by name in the implementation steps"
  ],
  "priority": "high"
}
```
