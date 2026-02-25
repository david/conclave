# User Message Markdown — Test Plan

This spec is entirely client-side rendering — no server changes. Tests are all unit-level, using `renderToStaticMarkup` to verify HTML output of React components, matching the project's existing pattern. The existing `markdown-text.test.tsx` heavily covers the current `MarkdownText` component; after the refactor, those tests migrate to `assistant-markdown.test.tsx`. New tests cover the `UserMarkdown` wrapper, the extracted shared module, and the updated rendering path in `message-list.tsx`.

## Existing Coverage

| Test file | Level | What it covers | Status |
|-----------|-------|---------------|--------|
| `client/components/markdown-text.test.tsx` | unit | `MarkdownText` conclave block fallbacks, `isReplay` prop, heading normalization, code fence separation | migrate |
| `client/components/message-list.test.tsx` | unit | `MessageList` isReplay computation for next-block buttons | extend |
| `client/components/event-model-diagram.test.tsx` | unit | `EventModelDiagram` rendering + `MarkdownText` eventmodel integration | extend |

Tests marked "migrate" move to a new file with updated imports — the test logic is unchanged, only the component name and import path change (`MarkdownText` → `AssistantMarkdown`, `markdown-text` → `assistant-markdown`). Tests marked "extend" need new test cases added alongside existing ones.

## UC-1 + UC-2 + UC-3: Shared Markdown Internals and Two Wrappers

### normalizeMarkdown — exported from markdown-shared and still works

- **Level:** unit
- **Status:** new
- **File:** `client/components/markdown-shared.test.tsx`
- **Covers:** Step 2 — extracting `normalizeMarkdown` to `markdown-shared.tsx`
- **Scenario:**
  - **Arrange:** Import `normalizeMarkdown` from `markdown-shared.tsx`
  - **Act:** Call with a string containing a heading glued to text (`"Text.### Heading"`)
  - **Assert:** Output contains `\n\n### Heading` — heading is separated onto its own line

### extractText — extracts plain text from nested React nodes

- **Level:** unit
- **Status:** new
- **File:** `client/components/markdown-shared.test.tsx`
- **Covers:** Step 2 — extracting `extractText` to `markdown-shared.tsx`
- **Scenario:**
  - **Arrange:** Import `extractText` from `markdown-shared.tsx`. Create nested React elements: `<span>Hello <strong>world</strong></span>`
  - **Act:** Call `extractText` on the element
  - **Assert:** Returns `"Hello world"`

### CopyButton — renders copy icon with correct aria-label

- **Level:** unit
- **Status:** new
- **File:** `client/components/markdown-shared.test.tsx`
- **Covers:** Step 2 — extracting `CopyButton` to `markdown-shared.tsx`
- **Scenario:**
  - **Arrange:** Import `CopyButton` from `markdown-shared.tsx`
  - **Act:** Render `<CopyButton text="some code" />` to static markup
  - **Assert:** Output contains `aria-label="Copy code"` and `code-block__copy` class

### baseComponents — links open in new tab

- **Level:** unit
- **Status:** new
- **File:** `client/components/markdown-shared.test.tsx`
- **Covers:** Step 2 — extracting `baseComponents` to `markdown-shared.tsx`
- **Scenario:**
  - **Arrange:** Import `baseComponents` from `markdown-shared.tsx`. Render `<ReactMarkdown components={baseComponents}>[link](https://example.com)</ReactMarkdown>` to static markup
  - **Act:** Inspect the rendered `<a>` tag
  - **Assert:** Has `target="_blank"` and `rel="noopener noreferrer"`

### makeCodeBlockPreHandler — renders standard code block with language label and copy button

- **Level:** unit
- **Status:** new
- **File:** `client/components/markdown-shared.test.tsx`
- **Covers:** Step 2 — `makeCodeBlockPreHandler` renders a standard code block
- **Scenario:**
  - **Arrange:** Import `makeCodeBlockPreHandler` from `markdown-shared.tsx`. Render a `<ReactMarkdown>` with `` ```js\nconst x = 1;\n``` `` using `components: { pre: makeCodeBlockPreHandler() }`
  - **Act:** Render to static markup
  - **Assert:** Output contains `code-block__lang">js<` and `code-block__copy`

### makeCodeBlockPreHandler — does not parse conclave blocks

- **Level:** unit
- **Status:** new
- **File:** `client/components/markdown-shared.test.tsx`
- **Covers:** Step 2 — `makeCodeBlockPreHandler` treats conclave-prefixed fences as standard code blocks
- **Scenario:**
  - **Arrange:** Render a `<ReactMarkdown>` with `` ```conclave:usecase\n{"id":"UC-1"}\n``` `` using `components: { pre: makeCodeBlockPreHandler() }`
  - **Act:** Render to static markup
  - **Assert:** Output contains `code-block` with language label `conclave:usecase`. Does NOT contain `uc-card`

### AssistantMarkdown — renders markdown with conclave blocks

- **Level:** unit
- **Status:** migrate
- **File:** `client/components/assistant-markdown.test.tsx`
- **Covers:** Step 3 — `AssistantMarkdown` preserves all existing `MarkdownText` behavior
- **Scenario:**
  - **Arrange:** Migrate all tests from `markdown-text.test.tsx`, updating imports from `MarkdownText`/`markdown-text` to `AssistantMarkdown`/`assistant-markdown`
  - **Act:** Run all migrated tests
  - **Assert:** All pass with identical assertions — conclave block fallbacks, isReplay, heading normalization, code fence separation

### AssistantMarkdown — renders bold, italic, lists, links, code blocks

- **Level:** unit
- **Status:** new
- **File:** `client/components/assistant-markdown.test.tsx`
- **Covers:** Step 3 — basic markdown rendering preserved after refactor
- **Scenario:**
  - **Arrange:** Render `<AssistantMarkdown text="**bold** *italic* [link](http://x.com)\n\n- item" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `<strong>bold</strong>`, `<em>italic</em>`, `<a href="http://x.com"`, `<li>item</li>`

### AssistantMarkdown — does NOT apply remark-breaks (single newline is not a br)

- **Level:** unit
- **Status:** new
- **File:** `client/components/assistant-markdown.test.tsx`
- **Covers:** Step 3 — assistant messages use standard markdown paragraph semantics
- **Scenario:**
  - **Arrange:** Render `<AssistantMarkdown text="line one\nline two" />`
  - **Act:** Render to static markup
  - **Assert:** Does NOT contain `<br` — single newline treated as soft break per standard markdown, not as `<br>`

### UserMarkdown — renders basic markdown formatting

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-1 — user messages render with markdown (bold, italic, code, lists, links)
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="**bold** and `code`\n\n- item one\n- item two" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `<strong>bold</strong>`, `<code>code</code>`, two `<li>` items

### UserMarkdown — renders links with target blank

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-1 — links in user messages open in new tab
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="[link](https://example.com)" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `target="_blank"` and `rel="noopener noreferrer"`

### UserMarkdown — renders code blocks with language label and copy button

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-1 — code blocks in user messages have language label and copy button
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="` `` ```python\nprint('hi')\n``` `` `" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `code-block__lang">python<` and `code-block__copy`

### UserMarkdown — single newline renders as line break via remark-breaks

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-2 — single newlines become `<br>` in user messages
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="line one\nline two" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `<br` between "line one" and "line two"

### UserMarkdown — double newline creates paragraph break

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-2 — double newlines still create paragraphs
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="paragraph one\n\nparagraph two" />`
  - **Act:** Render to static markup
  - **Assert:** Contains two separate `<p>` elements, one with "paragraph one" and one with "paragraph two". Does NOT contain `<br` between them.

### UserMarkdown — conclave:usecase block renders as plain code block

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-3 — conclave blocks are not parsed in user messages
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="` `` ```conclave:usecase\n{\"id\":\"UC-1\",\"name\":\"Test\"}\n``` `` `" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `code-block` with language label. Does NOT contain `uc-card`

### UserMarkdown — conclave:eventmodel block renders as plain code block

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-3 — event model blocks not parsed in user messages
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="` `` ```conclave:eventmodel\n{\"slice\":\"test\",\"events\":[{\"name\":\"E\"}]}\n``` `` `" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `code-block`. Does NOT contain `em-diagram`

### UserMarkdown — conclave:next block renders as plain code block

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** UC-3 — next blocks not parsed in user messages
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="` `` ```conclave:next\n{\"label\":\"Go\",\"command\":\"/run\",\"metaContext\":\"x\"}\n``` `` `" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `code-block`. Does NOT contain `next-block__diamond`

### UserMarkdown — applies normalizeMarkdown to input

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** Step 4 — `UserMarkdown` runs `normalizeMarkdown` on input text
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="Some text.### Heading" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `<h3` — heading normalization was applied

### UserMarkdown — wraps output in message__text--markdown class

- **Level:** unit
- **Status:** new
- **File:** `client/components/user-markdown.test.tsx`
- **Covers:** Step 4 — `UserMarkdown` uses the same CSS class as assistant markdown
- **Scenario:**
  - **Arrange:** Render `<UserMarkdown text="hello" />`
  - **Act:** Render to static markup
  - **Assert:** Contains `message__text--markdown` class. Does NOT contain a bare `message__text"` without the modifier (ensuring the markdown class is applied, not the old plain text class)

### MessageList — user text blocks render with UserMarkdown

- **Level:** unit
- **Status:** extend
- **File:** `client/components/message-list.test.tsx`
- **Covers:** Step 5 — `message-list.tsx` renders user text segments via `UserMarkdown`
- **Scenario:**
  - **Arrange:** Create a `Message` with role "user" and content `[{ type: "text", text: "**bold** text" }]`. Render `<MessageList messages={[msg]} streamingContent={[]} isProcessing={false} />`
  - **Act:** Render to static markup
  - **Assert:** Contains `<strong>bold</strong>` — user text is rendered as markdown, not plain text. Contains `message__text--markdown` class

### MessageList — user messages get line breaks from remark-breaks

- **Level:** unit
- **Status:** extend
- **File:** `client/components/message-list.test.tsx`
- **Covers:** Step 5 — user messages in the message list preserve single newlines as `<br>`
- **Scenario:**
  - **Arrange:** Create a user `Message` with text `"line one\nline two"`. Render in `<MessageList>`
  - **Act:** Render to static markup
  - **Assert:** Contains `<br` between "line one" and "line two"

### MessageList — assistant text blocks still render with AssistantMarkdown

- **Level:** unit
- **Status:** extend
- **File:** `client/components/message-list.test.tsx`
- **Covers:** Step 5 — assistant rendering unchanged after import rename
- **Scenario:**
  - **Arrange:** Create an assistant `Message` with text containing a conclave:next block. Render in `<MessageList>`
  - **Act:** Render to static markup
  - **Assert:** Contains `next-block__diamond` — conclave blocks still parsed for assistant messages (existing tests already cover this, this confirms the rename didn't break it)

### EventModelDiagram integration — import updated to AssistantMarkdown

- **Level:** unit
- **Status:** extend
- **File:** `client/components/event-model-diagram.test.tsx`
- **Covers:** Step 6 — `MarkdownText` import updated to `AssistantMarkdown` in integration tests
- **Scenario:**
  - **Arrange:** Update the import in `event-model-diagram.test.tsx` from `MarkdownText`/`markdown-text` to `AssistantMarkdown`/`assistant-markdown`
  - **Act:** Run existing integration tests
  - **Assert:** All existing `MarkdownText eventmodel integration` tests pass unchanged
