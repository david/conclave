# Bug: Silent Turn on Unknown Skill Invocation — Tasks

Two-wave red-green TDD cycle: wave 0 writes failing tests that reproduce the bug, wave 1 applies the one-line fix to make them pass.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Red: tests for empty-turn fallback",
    "ucs": [],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": ["client/slices/turn-completed.test.ts"],
      "modify": []
    },
    "description": "Write tests that reproduce the silent-turn bug. Two test cases: (1) TurnCompleted with non-empty streamingContent flushes as today (baseline), (2) TurnCompleted with empty streamingContent expects a fallback assistant message with content [{ type: 'text', text: '(No response from agent)' }]. The second test must fail red against the current codebase — the assertion will show that no assistant message was added."
  },
  {
    "id": "T-1",
    "name": "Green: add fallback message on empty turn",
    "ucs": [],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/slices/turn-completed.ts"]
    },
    "description": "In turnCompletedSlice, when streamingContent is empty, instead of skipping message creation, push a fallback assistant message with content [{ type: 'text', text: '(No response from agent)' }]. The logic becomes: if hasContent, flush streamingContent as today; otherwise, create the fallback content array as the assistant message. Run the T-0 tests — all must pass green."
  }
]
```

## Wave 0 (parallel)

### T-0: Red — tests for empty-turn fallback
- **Files**: create `client/slices/turn-completed.test.ts`
- **Summary**: Write a new test file that imports `turnCompletedSlice` and exercises it against two scenarios. These tests run against the *current* codebase — the second test must fail red, proving the bug exists.
- **Tests**:
  - `TurnCompleted with non-empty streamingContent flushes content into assistant message` — Set up state with `streamingContent: [{ type: "text", text: "hello" }]` and `isProcessing: true`. Apply `TurnCompleted` event. Assert: `messages` gains one assistant entry with the streaming content, `streamingContent` resets to `[]`, `isProcessing` becomes `false`.
  - `TurnCompleted with empty streamingContent produces fallback assistant message` — Set up state with `streamingContent: []` and `isProcessing: true`. Apply `TurnCompleted` event. Assert: `messages` gains one assistant entry with content `[{ type: "text", text: "(No response from agent)" }]`, `streamingContent` stays `[]`, `isProcessing` becomes `false`.

## Wave 1 (after wave 0)

### T-1: Green — add fallback message on empty turn
- **Depends on**: T-0
- **Files**: modify `client/slices/turn-completed.ts`
- **Summary**: Modify the `turnCompletedSlice` reducer so that every completed turn produces an assistant message. When `streamingContent` is empty, create a fallback: `[{ type: "text", text: "(No response from agent)" }]`. The existing branch for non-empty content stays unchanged.
- **Steps**:
  1. In `turnCompletedSlice`, change the `messages` assignment: when `hasContent` is `false`, instead of keeping `state.messages` unchanged, push a new assistant message with the fallback content.
  2. The resulting code: `const content = hasContent ? state.streamingContent : [{ type: "text" as const, text: "(No response from agent)" }];` then always append `{ role: "assistant" as const, content }` to messages.
  3. Run `bun test client/slices/turn-completed.test.ts` — all tests must pass green.
