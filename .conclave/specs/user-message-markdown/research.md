# User Message Markdown Rendering

User types markdown in chat input and wants to see it rendered with formatting, just like assistant messages.

## Findings

### Current rendering split

The branching point is `message-list.tsx:91-94` in `RenderSegmentView`. User text renders as plain text in a `<div className="message__text">`, while assistant text goes through the `MarkdownText` component (`markdown-text.tsx`) which provides react-markdown + remark-gfm + rehype-highlight.

### MarkdownText component internals

The current `MarkdownText` component bundles three concerns:

1. **Core markdown pipeline** — `ReactMarkdown` with `remarkGfm`, `rehypeHighlight`, `normalizeMarkdown()` preprocessing, base link component (`target="_blank"`), and code block rendering with language label + `CopyButton`.
2. **Conclave custom blocks** — The `pre` handler parses `conclave:next`, `conclave:usecase`, and `conclave:eventmodel` fenced code blocks into rich UI (buttons, cards, diagrams). After rendering, valid `conclave:eventmodel` slices are extracted and rendered as an `EventModelDiagram`.
3. **Interactive props** — `onNextBlockClick` and `isReplay` control conclave:next button behavior. These are assistant-only interaction features.

Concerns 2 and 3 are assistant-specific. Concern 1 is shared.

### Line break semantics

User messages currently use `white-space: pre-wrap` (CSS on `.message__text`), so every newline from the textarea renders visually. Markdown's default collapses single newlines. For user-typed chat messages, `remark-breaks` (or `breaks: true` in remark-gfm) should be enabled so single newlines become `<br>` — matching Slack/Discord behavior and preserving the feel of the chat input.

Assistant messages should NOT get `breaks: true` — Claude's markdown uses standard paragraph breaks and enabling breaks would mess up formatting.

### Styling

User markdown will pick up the `.message__text--markdown` class, which sets `white-space: normal` and adjusted typography. This is fine — the `breaks: true` remark option handles line break preservation at the AST level rather than CSS level.

## Leanings

- **Two thin wrappers over shared internals (option B).** Extract shared pieces (plugins, `normalizeMarkdown`, `CopyButton`, base components, code block `pre` handler) into a shared module. `AssistantMarkdown` keeps conclave block parsing, event model diagram, and interactive props. `UserMarkdown` is a minimal wrapper: shared markdown pipeline + `remark-breaks` for line break preservation.
- **No conclave block parsing for user messages.** The conclave:next, conclave:usecase, and conclave:eventmodel handlers are assistant-only features. User markdown gets a simpler `pre` handler — just code blocks with language label and copy button.
- **`remark-breaks` for user messages only.** Single newlines in user input should render as line breaks, matching chat input expectations.

## Open Questions

- Does `remark-breaks` need to be added as a dependency, or is it already available? (Likely needs `bun add remark-breaks`.)
