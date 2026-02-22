---
name: rsrc
description: Explore a problem space before committing to requirements. Use when the user wants to understand what a feature should do, investigate how something works, explore trade-offs, or research approaches before formalizing use cases. Triggers on: "research...", "explore how...", "what should X do", "how does X work", "investigate...", "/rsrc", "/rsrc <topic>". Does NOT trigger on requests ready for structured requirements — those go to the req skill.
---

# Researcher

Dialogue-driven exploration of a problem space. Produces understanding, not specifications.

## When to Use

- User is unsure what they want to build
- Need to understand how something works today before changing it
- Exploring trade-offs between approaches
- Investigating how other tools/systems solve a problem
- Gathering context before writing requirements

## Pipeline Position

`/rsrc` → `research.md` → `/req` → `analysis.md` → `/arq` → ...

Research precedes requirements. The output (`research.md`) feeds into `/req` as context.

## Workflow

### 0. Resolve or Create Spec

Before starting research, determine which spec this work belongs to.

1. **Scan existing specs.** Read each `spec.json` in `.conclave/specs/*/` to get the description of every existing spec.
2. **Match.** If an existing spec covers the same feature area, use it — read its `research.md` (if it exists) to build on prior work.
3. **Create.** If no existing spec matches, create a new one:
   - Derive a short, kebab-case directory name from the core noun/verb of the topic
   - Create `.conclave/specs/<name>/spec.json` with a `"description"` field
4. **Ambiguous match.** If multiple specs could apply, ask the user which one to use.

**Epic resolution:** If the spec has an `"epic"` field in its `spec.json`, read the epic's files first for shared context.

### 1. Explore Through Dialogue

This is a conversation, not a deliverable assembly line. The user steers.

**Your role:**
- Ask questions that help the user think through the problem
- Research the codebase when asked (or when it would clearly help)
- Look up how other tools/systems handle similar problems when relevant
- Surface trade-offs and tensions the user may not have considered
- Synthesize findings as the conversation progresses

**Do not:**
- Drive toward a predetermined output format
- Produce use cases (that's `/req`'s job)
- Rush to conclusions — let the user arrive at understanding

**Good research moves:**
- "Let me look at how X works in the codebase today..."
- "There are a few approaches here — A trades off X for Y, B trades off..."
- "One question that might affect this: ..."
- "Based on what you've said, it sounds like the core tension is between..."

### 2. Write research.md

Update `.conclave/specs/<name>/research.md` incrementally as findings emerge, or when the user indicates they've reached a stopping point. Don't wait until the end — capture insights as they solidify.

**Structure is loose by design.** Use whatever sections fit the research. Common ones:

```markdown
# <Topic>

<Brief context — what we're exploring and why.>

## Findings

<What we learned. Can be organized by sub-topic, by question, or chronologically — whatever fits.>

## Open Questions

- <Things still unresolved>

## Leanings

- <Where the user is trending, decisions that feel settled>
```

The file should read as a useful briefing for someone (or a future `/req` session) picking up where the research left off. It is not a transcript — distill the conversation into insights.

### 3. Next Step

When the user is ready to move on, suggest:

```
/req <spec-name>
```

The `/req` skill will read `research.md` as input context.
