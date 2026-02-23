# Bug: Silent Turn on Unknown Skill Invocation — Implementation

Add a fallback assistant message when a turn completes with no streaming content, so the user always sees a response.

## Fix

**Files:**
- `client/slices/turn-completed.ts` — add fallback message for empty turns

**Steps:**
1. In `turnCompletedSlice`, when `streamingContent` is empty (`hasContent` is `false`), instead of skipping message creation, push a fallback assistant message with a single text block: `"(No response from agent)"`.
2. The resulting logic: if `streamingContent` has content, flush it as today; otherwise, create `[{ type: "text", text: "(No response from agent)" }]` as the assistant message content.

## New Tests

**Files:**
- `client/slices/turn-completed.test.ts` — new test file

**Tests:**
- `TurnCompleted with non-empty streamingContent flushes content into assistant message` → messages gains one assistant entry with the streaming content, streamingContent resets to `[]`, isProcessing becomes `false`
- `TurnCompleted with empty streamingContent produces fallback assistant message` → messages gains one assistant entry with content `[{ type: "text", text: "(No response from agent)" }]`, streamingContent stays `[]`, isProcessing becomes `false`
