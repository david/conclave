# Bug: Markdown Headers Rendered Inline — Tasks

Two-wave TDD cycle: red tests first (wave 0), then the fix (wave 1).

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Red: tests reproducing inline heading bug",
    "ucs": [],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/markdown-text.test.tsx"]
    },
    "description": "Add five failing tests to the existing markdown-text.test.tsx that reproduce the bug: headings without preceding blank lines render inline instead of as heading elements."
  },
  {
    "id": "T-1",
    "name": "Green: normalizeMarkdown fix",
    "ucs": [],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/markdown-text.tsx"]
    },
    "description": "Add a normalizeMarkdown function and apply it in MarkdownText so all T-0 tests pass green."
  }
]
```

## Wave 0

### T-0: Red — tests reproducing inline heading bug
- **Files**: modify `client/components/markdown-text.test.tsx`
- **Summary**: Add a new `describe` block to the existing test file with five tests that exercise the heading normalization behavior. These tests should fail against the current codebase because headings without preceding blank lines are rendered as inline text, not as `<h3>`/`<h2>` elements.
- **Tests**:
  1. `"heading immediately after text on same line is rendered as a heading"`: input `"Some text.### Heading"` → output HTML contains an `<h3>` element with text "Heading"
  2. `"heading with existing preceding newline is unchanged"`: input `"Some text.\n\n### Heading"` → output HTML contains an `<h3>` element (no double-insertion of newlines)
  3. `"heading at start of text is unchanged"`: input `"### Heading\n\nSome text."` → output HTML contains an `<h3>` element
  4. `"multiple heading levels without preceding newlines are all normalized"`: input `"Text.## H2 more.### H3"` → output HTML contains both `<h2>` and `<h3>` elements
  5. `"hash characters in non-heading context are not affected"`: input `"Issue #123 is fixed"` → output does NOT contain a heading element (the `#` is followed by a digit, not a space, so the regex should not match)
- **Approach**: Use the same pattern as the existing tests — `renderToStaticMarkup(<MarkdownText text={...} />)` and assert on the resulting HTML string.
- **Validation**: Run `bun test client/components/markdown-text.test.tsx` — the five new tests must FAIL (red). Existing tests must still pass.

## Wave 1 (after wave 0)

### T-1: Green — normalizeMarkdown fix
- **Depends on**: T-0
- **Files**: modify `client/components/markdown-text.tsx`
- **Summary**: Add a `normalizeMarkdown(text: string): string` function and wire it into the `MarkdownText` component so that ATX headings always have a preceding blank line.
- **Steps**:
  1. Add a `normalizeMarkdown` function near the top of the file (below imports, above components). Use the regex `/([^\n])(#{1,6}\s)/g` → replace with `$1\n\n$2`. This inserts `\n\n` before any ATX heading marker that immediately follows a non-newline character on the same line. Headings that already start on their own line are unaffected.
  2. In the `MarkdownText` component, apply `normalizeMarkdown` to the `text` prop using `useMemo` before it is used anywhere — both before the `eventModelRegex` extraction and before passing to `<ReactMarkdown>`. Store the normalized text in a `const normalizedText = useMemo(() => normalizeMarkdown(text), [text])` and use `normalizedText` throughout.
- **Validation**: Run `bun test client/components/markdown-text.test.tsx` — all T-0 tests must now PASS (green). All existing tests must still pass.

```conclave:next
{"label":"Continue to Orchestration","command":"/orc bug-markdown-header-no-separation","metaContext":"bug-markdown-header-no-separation"}
```
