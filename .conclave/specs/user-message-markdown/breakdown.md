# User Message Markdown — Implementation

Refactor `markdown-text.tsx` into shared internals plus two thin wrapper components (`AssistantMarkdown` and `UserMarkdown`), then swap user message rendering in `message-list.tsx` from plain text to `UserMarkdown` with `remark-breaks` for chat-style line breaks.

## New Types

No new types are needed. Both wrappers produce the same `message__text--markdown` DOM structure. The existing `MarkdownTextProps` type will be replaced by component-specific props on each wrapper.

## UC-1 + UC-2 + UC-3: Shared Markdown Internals and Two Wrappers

All three use cases converge on the same file restructuring, so they are implemented together.

**Files:**
- `client/components/markdown-shared.tsx` — new; shared markdown pipeline pieces
- `client/components/assistant-markdown.tsx` — new; replaces current `MarkdownText`
- `client/components/user-markdown.tsx` — new; thin wrapper with `remark-breaks`
- `client/components/markdown-text.tsx` — delete after migration
- `client/components/message-list.tsx` — swap user text rendering to `UserMarkdown`
- `package.json` — add `remark-breaks` dependency

**Steps:**

1. **Add `remark-breaks` dependency.** Run `bun add remark-breaks`. This is the only new dependency.

2. **Create `markdown-shared.tsx`.** Extract from `markdown-text.tsx`:
   - `normalizeMarkdown()` function (exported)
   - `CopyButton` component (exported)
   - `extractText()` helper (exported)
   - `baseComponents` object (exported) — the `a` component with `target="_blank"`
   - A `makeCodeBlockPreHandler()` function (exported) that returns the standard code-block `pre` handler: language label + `CopyButton`. This is the plain code block renderer without any conclave-specific parsing. It takes no arguments — it always renders a standard code block.

3. **Create `assistant-markdown.tsx`.** This is a focused refactor of the current `MarkdownText` component:
   - Import shared pieces from `markdown-shared.tsx`
   - Import conclave-specific components (`UseCaseCard`, `InlineUseCases`, `parseEventModelSlice`, `NextBlockButton`, `EventModelDiagram`) — move these from `markdown-text.tsx` into this file since they are assistant-only
   - Define `makePreHandler()` locally (the conclave-aware version that delegates to `makeCodeBlockPreHandler` for non-conclave blocks)
   - Export `AssistantMarkdown` component with props: `text`, `onNextBlockClick?`, `isReplay?`
   - Uses `remarkGfm` + `rehypeHighlight` (no `remark-breaks`)
   - Preserves the `EventModelDiagram` rendering after `ReactMarkdown` for valid `conclave:eventmodel` slices

4. **Create `user-markdown.tsx`.**
   - Import shared pieces from `markdown-shared.tsx`
   - Import `remarkBreaks` from `remark-breaks`
   - Export `UserMarkdown` component with a single prop: `text`
   - `remarkPlugins`: `[remarkGfm, remarkBreaks]`
   - `rehypePlugins`: `[rehypeHighlight]`
   - `components`: `{ ...baseComponents, pre: makeCodeBlockPreHandler() }` — standard code blocks, no conclave parsing
   - Wraps in `<div className="message__text message__text--markdown">` (same class as assistant, so all existing CSS applies)
   - Uses `normalizeMarkdown()` on the input text

5. **Update `message-list.tsx`.** In `RenderSegmentView`, replace the user text branch:
   - Remove: `return <div className="message__text">{segment.block.text}</div>;`
   - Add: `return <UserMarkdown text={segment.block.text} />;`
   - Update imports: add `UserMarkdown`, rename `MarkdownText` import to `AssistantMarkdown`
   - Update the assistant text branch to use `AssistantMarkdown` instead of `MarkdownText`
   - Update `ThoughtBlockView` to use `AssistantMarkdown` instead of `MarkdownText`

6. **Delete `markdown-text.tsx`.** After all imports have been migrated, remove the old file. Grep for any remaining imports of `MarkdownText` or `markdown-text.tsx` across the codebase and update them to `AssistantMarkdown` / `assistant-markdown.tsx`.
