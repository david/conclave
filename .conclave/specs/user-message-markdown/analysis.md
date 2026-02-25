# User Message Markdown Rendering

Render user-authored messages with markdown formatting instead of plain text, matching the rendering quality of assistant messages while preserving chat-style line break behavior.

## Decisions

- **Two wrappers, shared internals**: Extract shared markdown pipeline pieces (plugins, `normalizeMarkdown`, `CopyButton`, base link component, code block `pre` handler) into a shared module. Create `AssistantMarkdown` (conclave blocks + interactive props) and `UserMarkdown` (remark-breaks, standard code blocks only) as thin wrappers. This avoids conditional logic and keeps each component focused.
- **`remark-breaks` for user messages only**: User messages get `remark-breaks` so single newlines become `<br>`, matching Slack/Discord chat behavior. Assistant messages keep standard markdown paragraph semantics — Claude's output uses double newlines for paragraph breaks.
- **No conclave block parsing for user messages**: The `pre` handler for user messages uses the standard code block renderer (language label + copy button) without conclave-specific parsing (no use case cards, next-block buttons, or event model diagrams).

## Use Cases

### UC-1: Render user message with markdown (High)
- **Actor:** End User
- **Summary:** User-authored messages render with full markdown formatting (headings, bold, italic, lists, links, code blocks) instead of plain text.
- **Given:**
  - User has an active chat session
  - User types a message containing markdown syntax (e.g. **bold**, `code`, lists)
- **When:**
  - User submits the message
  - The message appears in the message list
- **Then:**
  - Markdown syntax is rendered as formatted HTML (bold text, inline code, code blocks, lists, links, etc.)
  - Code blocks display with language label and copy button, matching assistant message code blocks
  - Links open in a new tab

### UC-2: Preserve line breaks in user messages (High)
- **Actor:** End User
- **Summary:** Single newlines in user messages render as visible line breaks, matching chat input expectations.
- **Given:**
  - User types a message with single newlines (not double) between lines
- **When:**
  - User submits the message
- **Then:**
  - Each single newline renders as a visible line break
  - Double newlines still create paragraph breaks
  - Behavior matches what the user saw while typing in the textarea

### UC-3: Exclude conclave blocks from user messages (Medium)
- **Actor:** End User
- **Summary:** Conclave-specific custom blocks are not parsed in user messages — they render as plain code blocks.
- **Given:**
  - User submits a message containing a conclave:-prefixed fenced code block
- **When:**
  - The message renders in the message list
- **Then:**
  - The conclave block renders as a standard code block with language label and copy button
  - No use case cards, next-block buttons, or event model diagrams are rendered
  - No errors occur

## Event Model

This spec is **purely client-side rendering** — no new commands, domain events, or projections are needed.

**Existing infrastructure (unchanged):**
- **Command:** `submit_prompt` — already carries user message text and images to the server
- **Event:** `PromptSubmitted` — already stores the user's text in the EventStore and relays it to clients
- **Client slice:** `promptSubmittedSlice` — already creates `TextBlock` content blocks from `event.text` and appends a user `Message` to `AppState.messages`

**What changes (client rendering only):**
- `message-list.tsx` `RenderSegmentView` currently renders user text blocks as plain `<div className="message__text">` — this will switch to a `UserMarkdown` component
- Shared markdown internals (`normalizeMarkdown`, `CopyButton`, `baseComponents`, rehype/remark plugins) will be extracted from `markdown-text.tsx` into a shared module
- `MarkdownText` will be renamed/refactored to `AssistantMarkdown` (conclave blocks + interactive props)
- `UserMarkdown` will be a thin wrapper using `remark-breaks` and a standard `pre` handler (no conclave parsing)

No event model diagram is emitted because there are no event-level changes to model.
