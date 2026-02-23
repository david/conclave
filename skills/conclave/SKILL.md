---
name: conclave
description: >
  Conclave custom markdown block reference. Provides schemas, field definitions, and examples
  for `conclave:usecase`, `conclave:eventmodel`, `conclave:tasks`, and `conclave:next` fenced code blocks.
  Use when emitting or parsing any `conclave:*` block — read the relevant reference file
  before generating output. Other skills (gather-requirements, architect, organize, plan) depend on this for output format.
---

# Conclave Blocks

Conclave extends markdown with custom fenced code blocks using the `conclave:` language prefix. The chat UI renders them as rich interactive components instead of plain code.

## Block Types

| Block | Rendered? | Reference | Emitted by | Consumed by |
|-------|-----------|-----------|------------|-------------|
| `conclave:usecase` | Yes — interactive card | [references/usecase.md](references/usecase.md) | gather-requirements | architect, plan |
| `conclave:eventmodel` | Yes — multi-column diagram | [references/eventmodel.md](references/eventmodel.md) | architect | plan |
| `conclave:tasks` | No — machine-readable only | [references/tasks.md](references/tasks.md) | organize | orchestrate |
| `conclave:next` | Yes — clickable button | [references/next.md](references/next.md) | skills | client |

Before emitting any block, read its reference file for the schema, field definitions, and examples.

Before parsing blocks from an existing `analysis.md` or `tasks.md`, read the relevant reference file to understand the structure.
