# Meta-Contexts

Group multiple ACP sessions under a single logical context so multi-phase workflows (like the spec pipeline) feel like one continuous conversation.

## Problem

Each skill in the pipeline (`/rsrc` → `/req` → `/arq` → `/plan` → `/org` → `/orc`) runs in a separate ACP session. Today that means:

- Manually opening a new session and invoking the next skill with the spec name
- The session picker fills with loosely-related sessions that are really all part of one workflow
- No sense of continuity between phases

## Findings

### Meta-context as a general grouping concept

A meta-context is **not** tied to specs. Specs are the first consumer, but the concept is general — any situation where multiple sessions are logically part of one body of work (debugging across sessions, exploratory work, feature branches) could use it.

However, for now only specs will create meta-contexts programmatically. There is no user-facing UI for creating one — only infrastructure.

### Data model

- A meta-context has an **ID** and a **name**
- A meta-context has an **ordered list of session IDs**
- Sessions not in any meta-context appear as standalone in the picker
- When you "open" a meta-context, you load the **most recent session**

### Session picker UX

The session picker (`react-select`) uses **grouped options** (native feature):

```
┌─────────────────────────────┐
│ Specs                       │  ← group label (meta-contexts)
│   services-panel            │  ← looks/behaves like a session entry
│   spec-system               │
│ ─────────────────────────── │
│ Sessions                    │  ← group label (standalone sessions)
│   "Fix the login bug"       │
│   "How does X work"         │
│ ─────────────────────────── │
│ + Create new session        │
└─────────────────────────────┘
```

- Meta-contexts appear as top-level entries, **not** expandable trees
- No session count or other metadata shown — just the name
- From the user's perspective, a meta-context **is** a session. The internal session boundaries are invisible.

### Phase transitions via `conclave:next` block

Skills do **not** create sessions. Instead, they emit a `conclave:next` markdown block declaring the suggested next step:

````
```conclave:next
{
  "label": "Continue to Architecture",
  "command": "/arq services-panel"
}
```
````

The UI renders this as a **button** inline in the message stream. When clicked:

1. A new ACP session is created within the current meta-context
2. The command is submitted as the first prompt in the new session
3. The user sees responses flowing in — feels like the conversation continued

The button should be **disabled after clicking** to prevent duplicate sessions.

### What skills don't need to know

Skills remain unaware of meta-contexts and sessions. They:
- Read/write spec files on disk (their existing continuity mechanism)
- Emit `conclave:next` blocks to suggest the next phase
- Never create or manage sessions

The UI and server handle all session lifecycle within a meta-context.

## Open Questions

- **Lazy loading of past sessions.** Eventually, selecting a meta-context should let you scroll back through previous sessions' messages. Not in scope now, but the data model should leave room for it. The open question is whether this looks like a continuous transcript with dividers, or an expandable "previous sessions" section.
- **Group label for meta-contexts.** Currently assumed to be "Specs" since specs are the only consumer. If other consumers emerge, this label may need to change or become dynamic.
- **Multiple next steps.** A skill might want to offer a choice ("Continue to Architecture" vs "Revise Requirements"). Could be multiple `conclave:next` blocks or an array format. Not designed yet.
- **Decoupling session creation from command submission.** Currently `conclave:next` always does both (creates a session and submits a command). Separating them could be useful if users gain the ability to create meta-contexts manually, but not needed now.

## Leanings

- Infrastructure first, no user-facing meta-context creation
- Meta-context is opaque — sessions within it are invisible to the user
- `conclave:next` is the inter-phase transition mechanism, keeping skills declarative
- The session picker uses `react-select` grouped options with two groups
- JSON format for `conclave:next` body, consistent with other `conclave:` blocks
