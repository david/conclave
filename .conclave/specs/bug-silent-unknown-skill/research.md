# Bug: Silent Turn on Unknown Skill Invocation

When a user invokes a non-existent skill (e.g. `/frontend-design`), the turn completes with no visible response — no error message, no assistant text, just silence.

## Symptom

User types `/frontend-design` in the chat input. A `PromptSubmitted` user message appears, then the processing indicator briefly shows, then nothing. No assistant message is rendered. The conversation shows the user's prompt with no reply.

## Root Cause

The Claude Code ACP agent handles the unknown skill invocation internally without emitting any `agent_message_chunk` session updates. The turn completes (the `prompt()` call resolves) and `TurnCompleted` is emitted, but `streamingContent` is empty.

- **Where:** `client/slices/turn-completed.ts:turnCompletedSlice`
- **What:** When `streamingContent` is empty, `hasContent` is `false` and no assistant message is added to `messages`. The slice only sets `isProcessing: false`.
- **Why:** The slice assumes every turn produces at least one content block. This assumption breaks when the ACP agent silently completes a turn — e.g. after a failed internal skill lookup, or potentially other edge cases like empty tool-only responses that get filtered.

The defect is not in the ACP agent (that's external) — it's that Conclave has no defense against a turn that produces zero visible content. The `turnCompletedSlice` silently swallows these turns instead of surfacing feedback.

## Missing Test Coverage

- **Test 1:** `TurnCompleted with empty streamingContent should produce a fallback assistant message` — the existing tests only cover the happy path where streaming content exists before `TurnCompleted`. A test with empty `streamingContent` would have revealed that the turn vanishes silently.
- **Test 2:** `TurnCompleted with only tool calls (no text) should still flush content` — verifying that tool-call-only turns are preserved (this already works, but was never explicitly tested as a boundary).

## Fix Approach

Modify `turnCompletedSlice` to detect when a turn completes with empty `streamingContent` and inject a fallback assistant message indicating the agent returned no content. This keeps the fix localized to one slice and ensures every completed turn produces visible output. The fallback text should be a neutral system-style message like "(No response from agent)" so it's clearly not agent-authored content.
