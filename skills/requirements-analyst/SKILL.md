---
name: req
description: Analyze feature requests and produce structured requirements through systematic decomposition. Use when a user describes a feature, system, or change they want built and needs requirements analysis before implementation. Triggers on requests like "analyze requirements for...", "what are the use cases for...", "break down this feature...", or when entering a requirements/analysis mode. Also appropriate when a user describes something to build with ambiguous scope, multiple actors, or underspecified behavior.
---

# Requirements Analyst

Systematic methodology for decomposing feature requests into structured, testable requirements.

## Core Principle: Calibrate Depth to Complexity

Match analysis effort to request size. Do not produce 15 use cases for a simple feature.

| Request size | Use cases | Clarifying questions | NFRs |
|---|---|---|---|
| Small (single interaction, e.g. "add a toggle") | 2–4 | 1–2 | Only if obvious |
| Medium (multi-step feature, e.g. "add auth") | 5–10 | 3–5 | Yes, key ones |
| Large (subsystem, e.g. "checkout flow") | 10+ delivered iteratively | 5+ | Comprehensive |

When unsure, **start small and ask** whether the user wants deeper analysis. Deliver core happy paths first, then offer to explore edge cases, error handling, and NFRs.

## Workflow

### 0. Resolve or Create Spec

Before doing any analysis, determine which spec this work belongs to.

1. **Scan existing specs.** Read each `spec.json` in `.conclave/specs/*/` to get the description of every existing spec.
2. **Match.** If an existing spec covers the same feature area or UI component as the user's request, use it — read its `analysis.md` (if it exists) so you can build on prior work. A spec about "git status in Files panel" matches a request to "add diff stats to the files view" but not "add a settings page".
3. **Create.** If no existing spec matches, create a new one:
   - Derive a short, kebab-case directory name from the core noun/verb of the feature (e.g. "Replace Files panel with git status" → `git-status-files`)
   - Create `.conclave/specs/<name>/spec.json` with a `"description"` field summarizing the feature
   - Analysis output (use cases) will be written to `.conclave/specs/<name>/analysis.md`
4. **Ambiguous match.** If multiple specs could apply, ask the user which one to use.

All use case output goes into the resolved spec's `analysis.md`.

### 1. Understand Before Producing

Read the full request. Identify:
- **What** is being asked for (the capability)
- **Who** uses it (actors — don't assume; ask if unclear)
- **Why** it matters (the underlying need, which may differ from the stated request)
- **Where** it fits (existing system context, adjacent features)

If the request is ambiguous or underspecified, ask clarifying questions *before* outputting requirements. Group questions logically — don't fire 10 questions at once.

Good clarifying questions target:
- Ambiguous scope ("Does 'user management' include self-service registration, or only admin-created accounts?")
- Unstated assumptions ("Should this work for unauthenticated users too?")
- Decision points ("Do you want optimistic UI updates or wait for server confirmation?")
- Priority signals ("Is offline support a must-have or a future consideration?")

### 2. Identify Actors

List all actors who interact with the feature. Use consistent names across all use cases. See `references/analysis-guidance.md` for common actor types.

### 3. Decompose into Atomic Use Cases

Each use case is a **unit of work** — something that can be developed, tested, and verified independently. If a use case can't be independently tested, it's not atomic enough and should be split further.

Split when:
- A workflow has distinct entry points
- Different actors perform different parts
- A step can succeed or fail independently
- Alternative flows are complex enough to warrant their own use case

**Dependencies**: Some use cases require others to exist first (e.g., "Reset password" depends on "Login with email"). Surface these dependencies explicitly so work can be sequenced. A use case with no dependencies can be started immediately; one with dependencies must wait for those to be completed.

**Naming**: Use short, action-oriented names ("Login with email", "Cancel subscription", "Retry failed payment").

**Sequencing**: Assign IDs (UC-1, UC-2, ...) in logical order — primary happy paths first, then alternatives, then error cases. Independent use cases (no dependencies) should come first where possible.

### 4. Write Given/When/Then

For each use case:
- **Given** (preconditions): What must be true before the action. Be specific — "User is logged in" not "User exists."
- **When** (action steps): What the actor does. Keep steps sequential and concrete.
- **Then** (outcomes): Observable results. Prefer testable statements — "Error message is displayed" over "System handles the error."

### 5. Discover Edge Cases

Identify the most likely and most damaging edge cases for each use case. Don't enumerate every edge case upfront — offer to go deeper if the user wants. See `references/analysis-guidance.md` for the probe checklist.

### 6. Identify Non-Functional Requirements

Only when the feature warrants it. Present NFRs separately from use cases — they crosscut multiple use cases. See `references/analysis-guidance.md` for the NFR checklist.

### 7. Prioritize

Assign priority to each use case:
- **High**: Core functionality — the feature doesn't work without this
- **Medium**: Important but the feature is usable without it (common alternative flows, secondary actors)
- **Low**: Nice-to-have (rare edge cases, polish, optimization)

Not everything is high priority. If everything is high, nothing is.

## Output Format

Use cases are both **emitted in chat** (as `conclave:usecase` fenced blocks for workspace rendering) and **written to the spec's `analysis.md`** file.

### analysis.md Template

```markdown
# <Feature Name>

<One-paragraph summary of what the feature does and why.>

## Use Cases

### UC-1: <Name> (<Priority>)
- **Actor:** <actor>
- **Summary:** <one sentence>
- **Given:** <preconditions>
- **When:** <action steps>
- **Then:**
  - <expected outcome 1>
  - <expected outcome 2>

### UC-2: <Name> (<Priority>, depends on UC-1)
...
```

Maintain this file as use cases are added, modified, or removed during the conversation.

Output **one fenced code block per use case**, each tagged `conclave:usecase` and containing a single JSON object:

````
```conclave:usecase
{
  "id": "UC-1",
  "name": "Short descriptive name",
  "actor": "Who performs the action",
  "summary": "One-sentence description of the use case",
  "given": ["Precondition 1", "Precondition 2"],
  "when": ["Action step 1", "Action step 2"],
  "then": ["Expected outcome 1", "Expected outcome 2"],
  "priority": "high",
  "dependencies": ["UC-0"]
}
```
````

For multiple use cases, emit separate blocks one after another:

````
```conclave:usecase
{ "id": "UC-1", ... }
```

```conclave:usecase
{ "id": "UC-2", ... }
```
````

### Field Definitions

- **id**: Sequential identifier (UC-1, UC-2, etc.)
- **name**: Short, action-oriented name (e.g. "Login with email/password")
- **actor**: The role performing the action (e.g. "End User", "Admin", "System")
- **summary**: One sentence describing the use case purpose
- **given**: Preconditions that must be true before the action (BDD Given)
- **when**: The steps the actor takes (BDD When)
- **then**: The expected outcomes after the action (BDD Then)
- **priority**: One of `"high"`, `"medium"`, or `"low"`
- **dependencies** *(optional)*: Array of use case IDs (e.g. `["UC-1", "UC-3"]`) that must be completed before this one can be started. Omit if the use case has no dependencies.

### Guidelines

1. **Analyze before outputting.** Understand the user's request fully before producing use cases. Ask clarifying questions if the request is ambiguous.
2. **Be thorough.** Cover the main success scenarios, important alternative flows, and key error cases.
3. **Keep use cases atomic.** Each use case should describe a single, cohesive interaction that can be developed, tested, and verified independently. Split complex workflows into multiple use cases. Use `dependencies` to make sequencing explicit when one use case requires another to be completed first.
4. **Use consistent actors.** Define actors clearly and reuse the same names across use cases.
5. **Prioritize realistically.** Not everything is high priority. Use `high` for core functionality, `medium` for important but non-critical features, and `low` for nice-to-haves.
6. **You may include explanatory text** outside the code blocks — discussion, questions, rationale — but all use cases must be inside `conclave:usecase` blocks.
7. **One block per use case.** Each `conclave:usecase` block should contain exactly one JSON object. This allows use cases to appear in the workspace incrementally as they are produced.
8. **Iterative refinement.** If the user asks to revise, output **only the changed use cases** — not the entire set. Unchanged use cases should be omitted. This keeps responses focused and avoids redundant output. **Always update the spec's `analysis.md`** to reflect the current state of all use cases (additions, modifications, and removals) so the file stays in sync with the conversation.

### Next Step

After all use cases are finalized, output a copyable command for the next phase:

```
/arq <spec-name>
```

Replace `<spec-name>` with the resolved spec directory name (e.g. `/arq git-status-files`). This lets the user paste it into a new session to begin architecture.

## Anti-Patterns to Avoid

- **Implementation leaking in**: Requirements describe *what*, not *how*. "User can filter results" not "Add a SQL WHERE clause."
- **Gold plating**: Adding requirements the user didn't ask for and doesn't need. Ask first.
- **Vague acceptance criteria**: "System should be fast" → "Search results appear within 200ms at P95."
- **Ignoring the user's context**: If they said it's a quick feature, don't treat it like an enterprise system.
