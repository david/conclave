# Bug: Markdown Headers Rendered Inline When Missing Preceding Newline

ATX headings (`#`, `##`, `###`, etc.) are rendered as literal inline text when the preceding text has no blank line before the heading marker.

## Symptom

In the chat UI, text like `...check.### Wave 1: Integration Check` appears as a single inline paragraph instead of the `###` being rendered as an `<h3>` heading. The heading marker is visible as literal characters in the rendered output.

## Root Cause

The defect is a missing normalization step at the rendering boundary. Two factors combine to produce the symptom:

- **Where:** `client/slices/utils.ts:appendStreamingText` (line 6) and `client/components/markdown-text.tsx:MarkdownText` (line 215)
- **What:** `appendStreamingText` concatenates consecutive `AgentText` chunks via `last.text + text` with no separator. When the LLM streams text in chunks that happen to split around a heading boundary (e.g., chunk 1 ends with `"...check."`, chunk 2 starts with `"### Wave 1"`), the result is a single string `"...check.### Wave 1"`. The `MarkdownText` component then passes this verbatim to `react-markdown`.
- **Why:** Per the CommonMark spec (section 4.2), an ATX heading requires the `#` characters to appear at the **beginning of a line** (after optional leading spaces). When `###` appears mid-line, it is parsed as ordinary inline content, not a heading. The LLM does not always emit `\n\n` before headings — the newlines may be absent from the token stream entirely, or the chunk boundary may split them in a way that they never appear in either chunk.

The correct fix location is the **rendering layer** (`MarkdownText`), not the accumulation layer (`appendStreamingText`). The accumulation function should remain a faithful concatenation of what the LLM sends. The rendering component is where markdown text should be normalized before parsing, since it is the consumer responsible for correct display.

## Missing Test Coverage

- **Test 1:** `MarkdownText` with heading immediately following text on the same line (e.g., `"Some text.### Heading"`) — would have revealed that `react-markdown` does not render the heading, exposing the need for normalization.
- **Test 2:** `appendStreamingText` accumulating two chunks where the second starts with `###` — would have shown the resulting string lacks a newline before the heading marker. (This test would be informational only; the accumulation behavior itself is correct.)
- **Test 3:** `MarkdownText` with other block-level elements lacking preceding newlines (e.g., `"text\n- list item"`, `"text\n> blockquote"`, `"text\n---"`) — would have revealed this as a general class of issue, not specific to headings.

## Fix Approach

Add a text normalization function in `MarkdownText` that inserts a blank line before block-level markdown syntax (ATX headings) when one is missing. Apply this normalization to the `text` prop before passing it to `react-markdown`. This keeps the data layer faithful to what the LLM sends while ensuring the rendering layer produces correct output. The normalization should use a regex to find `#` markers that appear mid-line (after a non-newline character) and insert `\n\n` before them.
