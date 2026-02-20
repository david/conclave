# Remove Mode Infrastructure

Replace the configurable multi-mode system with a modeless architecture. The requirements output format moves into the requirements-analyst skill, and all mode infrastructure (loading, switching, UI, events) is deleted.

## Context

The mode system bundles four concerns — output format, behavioral instructions, UI metadata, and per-turn prompt injection — into a single configurable abstraction. In practice, these concerns are better served by existing primitives: skills teach the agent about output formats, the workspace renders structured blocks regardless of how they were produced, and conversational context naturally carries behavioral framing across turns. Modes add complexity without proportional value.

## Approach

This is primarily a deletion task. The one piece that needs a new home is the `conclave:requirements` output format, which folds into the requirements-analyst skill. Everything else is removed. The `disallowedTools` setting for plan mode (in `acp-bridge.ts`) is unrelated to mode infrastructure and stays.

## Use Cases

```conclave:requirements
{
  "id": "UC-1",
  "name": "Merge output format into requirements-analyst skill",
  "actor": "Developer",
  "summary": "Move the conclave:requirements output format specification from the mode instruction into the requirements-analyst SKILL.md.",
  "given": [
    "The output format (JSON schema, fenced block convention, field definitions, guidelines) currently lives in .conclave/modes/requirements.md",
    "The requirements-analyst skill at ~/.claude/skills/requirements-analyst/SKILL.md currently defers to 'the active mode instruction' for output format"
  ],
  "when": [
    "Developer appends the output format section, field definitions, and guidelines from requirements.md into SKILL.md",
    "Developer removes the 'Always use the output format defined by the active mode instruction' line from SKILL.md",
    "Developer removes the 'Use the requirements-analyst skill methodology' guideline (now self-referential)"
  ],
  "then": [
    "SKILL.md is self-contained: it describes both the methodology and the conclave:requirements output format",
    "The skill works without any mode infrastructure — Claude Code activates it based on context and it knows how to emit structured blocks"
  ],
  "priority": "high"
}
```

```conclave:requirements
{
  "id": "UC-2",
  "name": "Remove server mode loading and prompt decoration",
  "actor": "Developer",
  "summary": "Remove mode-loader.ts, mode-marker.ts, and all mode-related logic from the server entry point.",
  "given": [
    "UC-1 is complete — the skill is self-contained",
    "server/index.ts imports loadModes, buildModeSystemPrompt, and maintains per-WS mode state",
    "server/index.ts decorates prompts with mode instructions and detects mode markers in agent text"
  ],
  "when": [
    "Developer deletes server/mode-loader.ts and server/mode-loader.test.ts",
    "Developer deletes server/mode-marker.ts and server/mode-marker.test.ts",
    "Developer removes mode imports, modeMap, modeSystemPrompt, and buildModeList() from index.ts",
    "Developer removes currentModeId from WsState and mode marker detector map",
    "Developer removes the prompt decoration block (the [Mode: Label] + instruction + skill prepending)",
    "Developer removes the set_mode command handler",
    "Developer removes the ModeList event sent on WS open",
    "Developer removes mode marker interception from AgentText and TurnCompleted handlers",
    "Developer removes the modeSystemPrompt parameter from createSession call (but keeps disallowedTools for plan mode)"
  ],
  "then": [
    "Server starts without loading any mode files",
    "Prompts are sent to ACP undecorated — the user's text goes through as-is",
    "No mode-related events are emitted or relayed",
    "The gray-matter dependency can be removed from package.json"
  ],
  "priority": "high",
  "dependencies": ["UC-1"]
}
```

```conclave:requirements
{
  "id": "UC-3",
  "name": "Remove server mode types and translation",
  "actor": "Developer",
  "summary": "Remove ModeChanged, ModeListEvent, ModeClientInfo, and SetModeCommand from server type definitions and ACP translation.",
  "given": [
    "UC-2 is complete — no server code references mode types"
  ],
  "when": [
    "Developer removes ModeChanged from the DomainEvent union in server/types.ts",
    "Developer removes ModeListEvent, ModeClientInfo types from server/types.ts",
    "Developer removes SetModeCommand from the Command union in server/types.ts",
    "Developer removes the current_mode_update case from acp-translate.ts",
    "Developer removes stripModePreamble() from acp-translate.ts",
    "Developer updates acp-translate.test.ts to remove mode-related tests"
  ],
  "then": [
    "Server type system has no mode-related types",
    "acp-translate only handles content events, not mode events"
  ],
  "priority": "high",
  "dependencies": ["UC-2"]
}
```

```conclave:requirements
{
  "id": "UC-4",
  "name": "Remove client mode state and slices",
  "actor": "Developer",
  "summary": "Remove availableModes and currentMode from AppState and delete mode-related slices.",
  "given": [
    "UC-3 is complete — the server no longer sends ModeChanged or ModeList events"
  ],
  "when": [
    "Developer removes availableModes and currentMode from AppState and initialState in client/types.ts",
    "Developer deletes client/slices/mode-changed.ts and client/slices/mode-changed.test.ts",
    "Developer deletes client/slices/mode-list.ts and client/slices/mode-list.test.ts",
    "Developer removes mode slice imports and entries from client/slices/index.ts",
    "Developer removes the plan-mode tool call suppression from client/slices/tool-call-started.ts",
    "Developer removes availableModes preservation from client/slices/session-switched.ts",
    "Developer removes mode-related test cases from client/reducer.test.ts",
    "Developer deletes client/mode-config.ts"
  ],
  "then": [
    "Client state has no mode-related fields",
    "No client slice references currentMode or availableModes",
    "Tool call display has no mode-specific suppression logic"
  ],
  "priority": "high",
  "dependencies": ["UC-3"]
}
```

```conclave:requirements
{
  "id": "UC-5",
  "name": "Remove ModePicker component and mode UI",
  "actor": "Developer",
  "summary": "Delete the ModePicker component, remove it from the chat header, and remove mode-related props and callbacks.",
  "given": [
    "UC-4 is complete — no client state feeds the mode UI"
  ],
  "when": [
    "Developer deletes client/components/mode-picker.tsx",
    "Developer removes ModePicker import and rendering from client/components/chat.tsx",
    "Developer removes the onSetMode prop from Chat and the handleSetMode callback from client/index.tsx",
    "Developer removes the getModeInfo call that drives the input placeholder (use a static placeholder instead)",
    "Developer removes the set_mode command sending logic from client/index.tsx"
  ],
  "then": [
    "Chat header no longer shows a mode picker",
    "Input bar uses a static placeholder",
    "No mode-switching UI exists"
  ],
  "priority": "high",
  "dependencies": ["UC-4"]
}
```

```conclave:requirements
{
  "id": "UC-6",
  "name": "Remove mode CSS",
  "actor": "Developer",
  "summary": "Remove mode color variables and all .mode-select styles from style.css.",
  "given": [
    "UC-5 is complete — no component references mode CSS classes"
  ],
  "when": [
    "Developer removes the --mode-* CSS custom properties (neutral, blue, purple, green, red, amber and their -dim variants)",
    "Developer removes all .mode-select* CSS rules (~160 lines)",
    "Developer removes any mode-color references in workspace status badge styles"
  ],
  "then": [
    "style.css has no mode-related styles",
    "No orphaned CSS rules remain"
  ],
  "priority": "medium",
  "dependencies": ["UC-5"]
}
```

```conclave:requirements
{
  "id": "UC-7",
  "name": "Delete .conclave/modes/ and update docs",
  "actor": "Developer",
  "summary": "Remove the .conclave/modes/ directory and update CLAUDE.md to reflect the modeless architecture.",
  "given": [
    "UC-2 through UC-6 are complete — no code references .conclave/modes/ or mode infrastructure"
  ],
  "when": [
    "Developer deletes .conclave/modes/ directory",
    "Developer updates CLAUDE.md: removes the Multi-Mode System section, removes mode-loader.ts and mode-marker.ts from server descriptions, removes mode-related fields from component descriptions",
    "Developer updates CLAUDE.md: notes that plan mode is disabled via disallowedTools (this stays)"
  ],
  "then": [
    "No .conclave/modes/ directory exists",
    "CLAUDE.md accurately describes the modeless architecture",
    "The requirements-analyst skill in .claude/skills/ is the sole source of requirements analysis behavior"
  ],
  "priority": "medium",
  "dependencies": ["UC-2", "UC-3", "UC-4", "UC-5", "UC-6"]
}
```

## Notes

- **Dependencies are mostly linear** (UC-1 → UC-2 → UC-3 → UC-4 → UC-5 → UC-6 → UC-7) because each step removes something the next references. In practice, a developer could do most of this in a single pass.
- **`disallowedTools` for plan mode stays** — it's in `acp-bridge.ts` and prevents Claude Code from using its built-in plan mode, independent of Conclave's mode system.
- **`buildModeSystemPrompt` injection at session creation goes away** — the agent no longer gets told about modes in its system prompt.
- **The `[conclave:mode X]` marker system goes away** — the agent can no longer proactively switch modes since modes don't exist.
- **gray-matter dependency** can be removed from package.json once mode-loader.ts is deleted.
