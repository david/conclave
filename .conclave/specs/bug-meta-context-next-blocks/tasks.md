# Bug: Meta-Context Next Blocks — Tasks

Both tasks are independent (no file overlaps, no data dependencies) and run in parallel in wave 0.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Update skill SKILL.md files to emit conclave:next blocks",
    "ucs": ["UC-1"],
    "depends": [],
    "wave": 0,
    "kind": "convention",
    "files": {
      "create": [],
      "modify": [
        "skills/requirements-analyst/SKILL.md",
        "skills/architect/SKILL.md",
        "skills/planner/SKILL.md",
        "skills/organizer/SKILL.md",
        "skills/bug/SKILL.md"
      ]
    },
    "description": "Replace plain-text command suggestions in each pipeline skill's final step with conclave:next fenced code block instructions."
  },
  {
    "id": "T-1",
    "name": "Add MessageList isReplay integration tests",
    "ucs": ["UC-2"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": ["client/components/message-list.test.tsx"],
      "modify": []
    },
    "description": "Create integration tests for the MessageList component's isReplay computation to verify next-block buttons are enabled in the last assistant message and disabled in all others."
  }
]
```

## Wave 0 (parallel)

### T-0: Update skill SKILL.md files to emit conclave:next blocks
- **UCs**: UC-1
- **Kind**: convention
- **Files**: modify `skills/requirements-analyst/SKILL.md`, modify `skills/architect/SKILL.md`, modify `skills/planner/SKILL.md`, modify `skills/organizer/SKILL.md`, modify `skills/bug/SKILL.md`
- **Summary**: Each pipeline skill's "next step" or "confirm with user" section currently outputs a plain-text copyable command (e.g. `` `/arq <spec-name>` ``). Replace these with instructions to emit a `conclave:next` fenced code block. The instruction should tell the agent to:
  1. Read `skills/conclave/references/next.md` for the schema
  2. Emit a fenced code block with language `conclave:next`
  3. Set `label` to a human-readable transition label
  4. Set `command` to the slash command with the spec name
  5. Set `metaContext` to the resolved spec name

  Specific transitions:

  | Skill | Label pattern | Command pattern |
  |-------|--------------|-----------------|
  | req | "Continue to Architecture" | `/arq <spec-name>` |
  | arq | "Continue to Planning" | `/plan <spec-name>` |
  | plan | "Continue to Task Organization" | `/org <spec-name>` |
  | org | "Continue to Orchestration" | `/orc <spec-name>` |
  | bug | "Continue to Task Organization" | `/org bug-<name>` |

  Skills with a "Confirm with User" section (arq, plan, org) should keep the offer to adjust, then add the `conclave:next` block after. Include a brief explanatory sentence before the block (e.g. "When you're ready for the next phase:").

- **Tests**: None (convention task — SKILL.md files are not code).

### T-1: Add MessageList isReplay integration tests
- **UCs**: UC-2
- **Kind**: code
- **Files**: create `client/components/message-list.test.tsx`
- **Summary**: Create integration tests using `renderToStaticMarkup` (matching the existing `markdown-text.test.tsx` pattern) to verify the `isReplay` computation in `MessageList`. The current logic (fixed in commit `58b7a46`) is believed correct, so tests should pass green — this is a coverage gap fill, not a red-green cycle.
- **Tests**:
  - "last assistant message renders next-block button as enabled" — Render a `MessageList` with a user message followed by an assistant message containing a `conclave:next` text block. Assert the HTML contains `next-block-btn` but NOT `next-block-btn--disabled` or `disabled`.
  - "earlier assistant messages render next-block buttons as disabled" — Render with two assistant messages (separated by a user message), both with `conclave:next` blocks. Assert the first assistant's button has `next-block-btn--disabled` and the second does not.
  - "committed messages during streaming have disabled buttons" — Render with non-empty `streamingContent` and a committed assistant message with a `conclave:next` block. Assert the committed message's button has `next-block-btn--disabled`.
  - "no streaming content: last assistant button is enabled" — Render with `streamingContent=[]`. Assert the last assistant message's button lacks `next-block-btn--disabled`.
