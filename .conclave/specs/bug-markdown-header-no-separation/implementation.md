# Bug: Markdown Headers Rendered Inline — Implementation

Normalize markdown text before rendering to ensure ATX headings always have a preceding blank line.

## Fix

**Files:**
- `client/components/markdown-text.tsx` — add a `normalizeMarkdown` function and apply it to the `text` prop before passing to `ReactMarkdown`

**Steps:**
1. Add a `normalizeMarkdown(text: string): string` function near the top of the file (below imports, above components). It should use a regex to find ATX heading markers (`#{1,6}\s`) that appear immediately after a non-newline character on the same line, and insert `\n\n` before them. The regex pattern: `/([^\n])(#{1,6}\s)/g` → replace with `$1\n\n$2`. This handles the case where `###` appears mid-line. It should NOT alter headings that already start on their own line.
2. In the `MarkdownText` component, apply `normalizeMarkdown` to the `text` prop before passing it to `<ReactMarkdown>` and before the `eventModelRegex` extraction. Use `useMemo` to avoid recomputing on every render.

## New Tests

**Files:**
- `client/components/markdown-text.test.tsx` — add tests to the existing test file

**Tests:**
- `"heading immediately after text on same line is rendered as a heading"`: input `"Some text.### Heading"` → output HTML contains an `<h3>` element with text "Heading"
- `"heading with existing preceding newline is unchanged"`: input `"Some text.\n\n### Heading"` → output HTML contains an `<h3>` element (no double-insertion of newlines)
- `"heading at start of text is unchanged"`: input `"### Heading\n\nSome text."` → output HTML contains an `<h3>` element
- `"multiple heading levels without preceding newlines are all normalized"`: input `"Text.## H2 more.### H3"` → output HTML contains both `<h2>` and `<h3>` elements
- `"hash characters in non-heading context are not affected"`: input `"Issue #123 is fixed"` → output does NOT contain a heading element (the `#` is followed by a digit, not a space, so the regex should not match)
