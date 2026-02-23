# Bug: Skills Don't Emit conclave:next Blocks and Buttons Render Disabled — Implementation

Update all pipeline skill SKILL.md files to emit `conclave:next` blocks instead of plain-text commands, and add integration tests for the button disabled-state logic.

## UC-1: Update Skill SKILL.md Files to Emit conclave:next Blocks

Each pipeline skill needs its "next step" / "confirm with user" section rewritten to instruct the agent to emit a `conclave:next` fenced code block.

**Files:**
- `skills/requirements-analyst/SKILL.md` — replace § Next Step
- `skills/architect/SKILL.md` — replace § Confirm with User (next step portion)
- `skills/planner/SKILL.md` — replace § Confirm with User (next step portion)
- `skills/organizer/SKILL.md` — replace § Confirm with User (next step portion)
- `skills/bug/SKILL.md` — replace § Next Step

**Steps:**

1. In each skill's final step section, replace the plain-text command suggestion with an instruction to emit a `conclave:next` fenced code block. The instruction should tell the agent to:
   - Read `skills/conclave/references/next.md` for the schema (consistent with the conclave skill's existing instruction pattern)
   - Emit a fenced code block with language `conclave:next`
   - Set `label` to a human-readable transition label (e.g. "Continue to Architecture")
   - Set `command` to the slash command with the spec name (e.g. `/arq <spec-name>`)
   - Set `metaContext` to the resolved spec name (e.g. `<spec-name>`)

2. Specific transitions per skill:

   | Skill | Label pattern | Command pattern |
   |-------|--------------|-----------------|
   | req | "Continue to Architecture" | `/arq <spec-name>` |
   | arq | "Continue to Planning" | `/plan <spec-name>` |
   | plan | "Continue to Task Organization" | `/org <spec-name>` |
   | org | "Continue to Orchestration" | `/orc <spec-name>` |
   | bug | "Continue to Task Organization" | `/org bug-<name>` |

3. Each skill should also retain a brief explanatory sentence before the block (e.g. "When you're ready for the next phase:") so the button has conversational context.

4. Skills that have a "Confirm with User" section (arq, plan, org) should keep the offer to adjust, then add the `conclave:next` block after the adjustment offer.

## UC-2: Add MessageList isReplay Integration Tests

**Files:**
- `client/components/message-list.test.tsx` — new test file

**Steps:**

1. Create `client/components/message-list.test.tsx` with tests using `renderToStaticMarkup` (matching the existing `markdown-text.test.tsx` pattern).

2. Test scenarios:
   - **Last assistant message has enabled next-block buttons**: Render a `MessageList` with `messages` containing a user message followed by an assistant message with a `conclave:next` text block. Verify the rendered HTML contains `next-block-btn` but NOT `next-block-btn--disabled`.
   - **Previous assistant messages have disabled next-block buttons**: Render a `MessageList` with two assistant messages (separated by a user message), both containing `conclave:next` blocks. Verify the first assistant message's button has `next-block-btn--disabled` and the second does not.
   - **During streaming, committed messages have disabled buttons**: Render a `MessageList` with `streamingContent` non-empty and a committed assistant message with a `conclave:next` block. Verify the committed message's button has `next-block-btn--disabled`.
   - **After streaming completes (no streaming content), last assistant enabled**: Render with `streamingContent=[]` and verify the last assistant message's button is enabled.

**Tests:**
- "last assistant message renders next-block button as enabled" → button element has class `next-block-btn` without `next-block-btn--disabled`
- "earlier assistant messages render next-block buttons as disabled" → first assistant's button has `next-block-btn--disabled`
- "committed messages during streaming have disabled buttons" → button has `next-block-btn--disabled` when `streamingContent` is non-empty
- "no streaming content: last assistant button is enabled" → button lacks `next-block-btn--disabled` class
