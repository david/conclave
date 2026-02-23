# Bug: Skills Don't Emit conclave:next Blocks and Buttons Render Disabled

Two related issues prevent the `conclave:next` workflow buttons from functioning: skills never emit them, and when they do appear (e.g. manual testing), the buttons render in a disabled state.

## Symptom

1. **No buttons emitted**: Pipeline skills (req, arq, plan, org, bug) output plain-text command suggestions (e.g. `` `/arq <spec-name>` ``) instead of `conclave:next` fenced code blocks that would render as clickable buttons.
2. **Buttons always disabled**: When `conclave:next` blocks are manually introduced, the rendered buttons appear in a disabled/grayed-out state and cannot be clicked.

## Root Cause

### Bug 1: Skills don't emit conclave:next blocks

- **Where:** `skills/requirements-analyst/SKILL.md` (§ Next Step), `skills/architect/SKILL.md` (§ Confirm with User), `skills/planner/SKILL.md` (§ Confirm with User), `skills/organizer/SKILL.md` (§ Confirm with User), `skills/bug/SKILL.md` (§ Next Step)
- **What:** Every skill's "next step" section instructs the agent to output a plain-text copyable command. None reference the `conclave:next` block format or the `skills/conclave/references/next.md` schema.
- **Why:** The `conclave:next` block type was defined in the conclave skill (`skills/conclave/SKILL.md` and `skills/conclave/references/next.md`) and the client rendering was implemented (`client/components/next-block-button.tsx`, `client/components/markdown-text.tsx`), but the individual skill SKILL.md files were never updated to use the new block format. The conclave skill's table lists `conclave:next` as "Emitted by: skills" but no skill was given the instruction.

### Bug 2: Buttons always rendered disabled

- **Where:** `client/components/message-list.tsx:159-163` (`isLastAssistant` computation)
- **What:** The `isReplay` flag is computed as `!isLastAssistant`. For all messages except the final assistant message (when not streaming), `isReplay=true`, which passes `disabled={true}` to `NextBlockButton`. The logic was fixed in commit `58b7a46` to correctly enable the last assistant message's buttons, but there are edge cases where buttons can still appear disabled:
  - **During active streaming**: `hasStreaming=true` causes `!hasStreaming` to be `false`, making `isLastAssistant=false` for ALL committed messages. The `conclave:next` block, which appears at the end of the agent's output, is only in `streamingContent` briefly before `TurnCompleted` flushes it to `messages`. However, if the user observes the message during the streaming→committed transition, React batching may briefly show the disabled state.
  - **Session with in-progress turn**: If a session is replayed while the agent is still processing (no `TurnCompleted` yet), `streamingContent` is non-empty after replay, making all committed messages show `isReplay=true`. The streaming message shows `isReplay={false}`, but if the `conclave:next` block was in a prior completed turn, that message would be disabled.
  - **No integration test coverage**: The `isReplay` computation in `MessageList` has zero test coverage — only the `MarkdownText` component's prop forwarding is tested.

## Missing Test Coverage

- **Test 1:** "MessageList renders the last assistant message's next-block buttons as enabled after turn completes" — would verify that after `TurnCompleted` flushes streaming to messages, the `conclave:next` button in the last assistant message has `disabled={false}`.
- **Test 2:** "MessageList renders previous assistant messages' next-block buttons as disabled" — would verify that earlier assistant messages have `disabled={true}`.
- **Test 3:** "Skill SKILL.md files reference conclave:next format" — not a code test, but a structural check that each pipeline skill's "next step" section emits the correct block format.

## Fix Approach

**Bug 1**: Update each pipeline skill's SKILL.md to replace plain-text command suggestions with `conclave:next` fenced code block instructions. Each skill should read `skills/conclave/references/next.md` before emitting and produce a JSON block with `label`, `command`, and `metaContext` fields. The `metaContext` should be set to the spec name to group all phases of the same spec together.

**Bug 2**: Add integration tests for the `MessageList` component's `isReplay` computation to ensure the last assistant message's buttons are enabled. The current logic appears correct after the `58b7a46` fix, but the lack of test coverage means regressions would go undetected. The tests will serve as both verification and regression protection.
