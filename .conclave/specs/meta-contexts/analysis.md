# Meta-Contexts

Group multiple ACP sessions under a single logical context so multi-phase workflows feel like one continuous conversation. The first consumer is the spec pipeline (`/rsrc` → `/req` → `/arq` → `/plan` → `/org` → `/orc`), but the mechanism is general-purpose.

## Decisions

- **Meta-context identity is name-based.** Find-or-create by name. For specs, the spec name is used as the meta-context name, but meta-contexts are independent of specs — any skill can group sessions under any name.
- **`conclave:next` is the transition mechanism.** Skills emit a `conclave:next` fenced code block with `label`, `command`, and `metaContext` fields. The UI renders it as a button. Clicking it creates a session within the named meta-context and submits the command. Skills never create sessions or meta-contexts directly.
- **`metaContext` is required.** A `conclave:next` block missing the `metaContext` field renders a warning instead of a functional button. The block exists for pipeline transitions, which should always have a context.
- **`conclave:next` schema lives in the conclave skill.** A `references/next.md` file defines the block schema, consistent with `usecase.md`, `eventmodel.md`, and `tasks.md`.
- **Meta-contexts are opaque in the picker.** They appear as top-level entries (not expandable trees). Selecting one loads the most recent session. Internal session boundaries are invisible in the picker.
- **Session picker uses grouped options.** Two groups: meta-contexts (labeled "Specs" for now) and standalone "Sessions". react-select's native grouped options. Group headers remain visible during text filtering; groups with no matches are hidden.
- **Meta-context state is a projection backed by a JSON file.** A `MetaContextRegistry` projection subscribes to meta-context events and maintains an in-memory `Map<string, MetaContext>` (id, name, ordered session IDs). Same pattern as `SessionRegistry`, but writes through to `.conclave/state/meta-contexts.json` on every change so meta-contexts survive server restarts. On startup, the projection hydrates from the JSON file before subscribing to new events.
- **Skills are meta-context-unaware.** They read/write spec files on disk and emit `conclave:next` blocks. The UI and server handle all session lifecycle.
- **No user-facing meta-context creation.** Only programmatic creation via `conclave:next` clicks. Manual assignment of standalone sessions to meta-contexts is out of scope.
- **Simple specs only.** Epics do not generate meta-contexts. Only the spec-level pipeline participates.
- **Buttons disable on click and on replay.** Next-block buttons are disabled after clicking (prevents duplicates) and when the block comes from a replayed past session (prevents stale actions).
- **No cross-session message loading (for now).** When switching to a meta-context, only the most recent session's messages are loaded. Loading earlier sessions' messages is deferred to avoid slow rendering of large sessions.

## Use Cases

### UC-1: Create meta-context on next-block click (High)
- **Actor:** End User
- **Summary:** Clicking a conclave:next button that names a meta-context creates the meta-context if it doesn't exist, creates a new session within it, and submits the command.
- **Given:**
  - A conclave:next block is rendered in the message stream with a metaContext field
  - No meta-context with that name exists yet
- **When:**
  - The user clicks the conclave:next button
- **Then:**
  - A new meta-context is created with the given name
  - A new ACP session is created and added to the meta-context
  - The command from the block is submitted as the first prompt in the new session
  - The chat view shows the new session's responses streaming in
  - The previous session's messages remain visible above (scroll up to see them)

### UC-2: Add session to existing meta-context on next-block click (High, depends on UC-1)
- **Actor:** End User
- **Summary:** Clicking a conclave:next button whose meta-context already exists adds the new session to that meta-context rather than creating a duplicate.
- **Given:**
  - A conclave:next block is rendered with a metaContext field
  - A meta-context with that name already exists (e.g. from an earlier phase)
- **When:**
  - The user clicks the conclave:next button
- **Then:**
  - A new ACP session is created and appended to the existing meta-context's session list
  - The command is submitted as the first prompt
  - The chat view shows the new session's responses, with previous messages still visible above

### UC-3: Disable next-block buttons for past and clicked states (High, depends on UC-4)
- **Actor:** End User
- **Summary:** A conclave:next button is disabled both after being clicked and when replaying a past session, preventing duplicate or stale session creation.
- **Given:**
  - A conclave:next block is rendered in the message stream
- **When:**
  - The user clicks the button, OR the block belongs to a replayed past session
- **Then:**
  - The button is visually disabled
  - Clicking it has no effect

### UC-4: Render conclave:next block as button (High)
- **Actor:** End User
- **Summary:** A conclave:next fenced code block in the message stream is rendered as a clickable button showing the label. The block schema is defined in the conclave skill's references/next.md.
- **Given:**
  - An assistant message contains a conclave:next fenced code block with label, command, and metaContext fields
  - The conclave skill has a references/next.md defining the block schema
- **When:**
  - The message is rendered in the chat pane
- **Then:**
  - A button is displayed inline with the label text
  - The button is clickable
  - The raw JSON is not shown to the user

### UC-5: Display meta-contexts as groups in session picker (High)
- **Actor:** End User
- **Summary:** The session picker shows meta-contexts and standalone sessions in separate groups, preserving group headers during search filtering.
- **Given:**
  - At least one meta-context exists with one or more sessions
  - Some standalone sessions also exist
- **When:**
  - The user opens the session picker dropdown, optionally typing to filter
- **Then:**
  - Meta-contexts appear as entries under a group label (e.g. "Specs")
  - Each meta-context entry shows its name as the label
  - Standalone sessions appear under a separate "Sessions" group label
  - When filtering by text, both group headers remain visible alongside their matching entries
  - Groups with no matches are hidden

### UC-6: Switch to a meta-context (High, depends on UC-5)
- **Actor:** End User
- **Summary:** Selecting a meta-context in the session picker loads its most recent session and replays that session's messages.
- **Given:**
  - A meta-context exists with at least one session
  - The user is currently in a different session or meta-context
- **When:**
  - The user selects a meta-context entry from the session picker
- **Then:**
  - The most recent session in the meta-context is loaded
  - That session's messages are replayed in the chat view
  - The session picker shows the meta-context as the current selection

### UC-8: Broadcast meta-context list to clients (High)
- **Actor:** System
- **Summary:** The server maintains a meta-context projection (read model) and includes meta-context data when broadcasting the session list.
- **Given:**
  - A meta-context projection subscribes to meta-context events in the EventStore
  - The projection hydrates from `.conclave/state/meta-contexts.json` on startup
  - A client is connected via WebSocket
- **When:**
  - The session list changes (session created, meta-context created, session added to meta-context)
- **Then:**
  - The meta-context projection maintains an in-memory Map of meta-contexts (id, name, ordered session IDs)
  - Changes are written through to `.conclave/state/meta-contexts.json`
  - The server broadcasts a session list event that includes meta-context data from the projection
  - Clients can distinguish between meta-context sessions and standalone sessions

### UC-9: Warn on conclave:next without metaContext (Medium, depends on UC-4)
- **Actor:** End User
- **Summary:** A conclave:next block missing the metaContext field renders as a warning instead of a functional button.
- **Given:**
  - A conclave:next block is rendered with label and command but no metaContext field
- **When:**
  - The message is rendered in the chat pane
- **Then:**
  - A warning indicator is shown instead of (or alongside) the button
  - The user is informed that the block is missing a required metaContext field
