# Spec System

Structured spec directory system for Conclave. One directory per spec, one file per development phase, visible in the workspace sidebar.

## Decisions

- **Structure**: One directory per spec in `.conclave/specs/`
- **Phases**: Fixed universal set (`analysis.md` → `implementation.md`), loosely applied. Later phase wins for status display.
- **Metadata**: Optional `spec.json` per spec for description, type, and epic membership.
- **Epics**: A spec with `"type": "epic"` in `spec.json`. Children declare membership via `"epic": "<name>"` in their own `spec.json`. Grouping is derived by the server at scan time.
- **Completion**: Delete the directory. Git preserves history.
- **Sidebar**: Specs section appears first in workspace accordion, collapsed by default. Shows spec name + current phase when expanded.
- **Data source**: Filesystem scan of `.conclave/specs/` on startup, with file watching for live updates.
- **Subtasks**: Lightweight — checklists within phase files. Promote to child spec if warranted.

## Use Cases

```conclave:requirements
{
  "id": "UC-1",
  "name": "Scan specs directory on startup",
  "actor": "System",
  "summary": "Server scans .conclave/specs/ on startup to discover spec directories, their phase files, and spec.json metadata.",
  "given": [
    "One or more directories exist under `.conclave/specs/`",
    "Each directory may contain phase files (`analysis.md`, `implementation.md`) and/or a `spec.json`"
  ],
  "when": [
    "Server starts up"
  ],
  "then": [
    "Server reads each subdirectory of `.conclave/specs/`",
    "For each spec, it checks for `spec.json` and parses it if present (description, type, epic reference)",
    "For each spec, it identifies which phase files exist and determines the current phase (latest phase file wins)",
    "Specs with `\"type\": \"epic\"` in `spec.json` are identified as epics",
    "Specs with an `\"epic\": \"<name>\"` field in `spec.json` are associated with that epic",
    "The resulting spec list is available to send to clients on WebSocket connect"
  ],
  "priority": "high"
}
```

```conclave:requirements
{
  "id": "UC-2",
  "name": "Determine spec phase from files",
  "actor": "System",
  "summary": "Derive a spec's current phase by checking which phase files exist, with later phases taking priority.",
  "given": [
    "A spec directory exists with one or more phase files",
    "The phase priority order is: `analysis.md` (phase: \"analysis\") → `implementation.md` (phase: \"implementation\")"
  ],
  "when": [
    "Server scans the spec directory"
  ],
  "then": [
    "If `implementation.md` exists, current phase is \"implementation\"",
    "If only `analysis.md` exists, current phase is \"analysis\"",
    "If no recognized phase files exist (e.g., only `spec.json`), the spec has no phase"
  ],
  "priority": "high",
  "dependencies": ["UC-1"]
}
```

```conclave:requirements
{
  "id": "UC-3",
  "name": "Send spec list to client on WebSocket connect",
  "actor": "System",
  "summary": "When a client connects via WebSocket, the server sends the current spec list as an event.",
  "given": [
    "Server has scanned `.conclave/specs/` and built the spec list",
    "A client connects via WebSocket"
  ],
  "when": [
    "WebSocket connection is established"
  ],
  "then": [
    "Server sends a `SpecList` event containing all discovered specs",
    "Each spec entry includes: directory name, description (from `spec.json`), current phase, type (epic or regular), and epic reference (if any)",
    "The client uses this to render the specs section in the workspace sidebar"
  ],
  "priority": "high",
  "dependencies": ["UC-1"]
}
```

```conclave:requirements
{
  "id": "UC-4",
  "name": "Display specs section in workspace sidebar",
  "actor": "End User",
  "summary": "Workspace sidebar shows a Specs section in first position listing active specs with their current phase.",
  "given": [
    "One or more specs have been discovered by the server",
    "The client has received the spec list over WebSocket"
  ],
  "when": [
    "User views the workspace sidebar"
  ],
  "then": [
    "A \"Specs\" section appears as the first accordion section (above Tasks and Files)",
    "The section is collapsed by default",
    "When collapsed, the summary shows the count of active specs (e.g., \"3 specs\")",
    "When expanded, standalone specs are listed at top level with name and current phase",
    "Spec name is derived from the directory name; description from `spec.json` if present"
  ],
  "priority": "high",
  "dependencies": ["UC-3"]
}
```

```conclave:requirements
{
  "id": "UC-5",
  "name": "Group child specs under epics in sidebar",
  "actor": "End User",
  "summary": "Specs that declare an epic in their spec.json are grouped and indented under that epic in the sidebar.",
  "given": [
    "One or more specs have `\"epic\": \"<name>\"` in their `spec.json`",
    "A spec directory with that name exists and has `\"type\": \"epic\"` in its `spec.json`"
  ],
  "when": [
    "User expands the Specs section in the sidebar"
  ],
  "then": [
    "The epic appears as a parent row showing its name and a summary of children's progress (e.g., \"2 of 4 done\")",
    "Child specs are indented underneath the epic, each showing name and current phase",
    "Standalone specs (no epic reference) are listed at the top level alongside epics",
    "If a spec references an epic that doesn't exist, it is treated as a standalone spec"
  ],
  "priority": "medium",
  "dependencies": ["UC-4"]
}
```

```conclave:requirements
{
  "id": "UC-6",
  "name": "Watch for spec directory changes",
  "actor": "System",
  "summary": "Server watches .conclave/specs/ for filesystem changes and broadcasts updates to connected clients.",
  "given": [
    "Server is running and has performed the initial spec scan",
    "One or more clients are connected"
  ],
  "when": [
    "A spec directory is created, deleted, or a phase file or spec.json is added/removed/modified"
  ],
  "then": [
    "Server detects the change and rescans the affected spec directory",
    "An updated `SpecList` event is broadcast to all connected clients",
    "The sidebar reflects the change without requiring a page refresh"
  ],
  "priority": "medium",
  "dependencies": ["UC-3"]
}
```

```conclave:requirements
{
  "id": "UC-7",
  "name": "Remove completed spec",
  "actor": "End User",
  "summary": "When a spec is complete, its directory is deleted and it disappears from the sidebar.",
  "given": [
    "A spec directory exists and is visible in the sidebar"
  ],
  "when": [
    "The spec directory is deleted (manually via filesystem or by a tool)"
  ],
  "then": [
    "The spec no longer appears in the sidebar",
    "If the spec referenced an epic, the epic's child count and progress update accordingly",
    "If an epic's last child is removed, the epic still appears (it must be deleted separately)",
    "Git history preserves the spec content for future reference"
  ],
  "priority": "medium",
  "dependencies": ["UC-6"]
}
```

```conclave:requirements
{
  "id": "UC-8",
  "name": "Requirements-analyst creates spec directory during analysis",
  "actor": "System",
  "summary": "When the req skill analyzes a feature, it creates the spec directory with analysis.md and optionally spec.json.",
  "given": [
    "User has described a feature and invoked the req skill"
  ],
  "when": [
    "The skill completes its analysis and produces use cases"
  ],
  "then": [
    "A new directory is created under `.conclave/specs/<spec-name>/`",
    "An `analysis.md` file is written containing the requirements output",
    "A `spec.json` is written with at minimum a description field",
    "The spec appears in the sidebar with phase \"analysis\"",
    "If the feature is large enough to warrant decomposition, the skill creates child spec directories each with their own `spec.json` containing `\"epic\": \"<parent-name>\"`, and the parent gets `\"type\": \"epic\"` in its `spec.json`"
  ],
  "priority": "medium",
  "dependencies": ["UC-1"]
}
```
