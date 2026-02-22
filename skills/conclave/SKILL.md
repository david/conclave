---
name: conclave
description: >
  Conclave custom markdown block reference. Provides schemas, field definitions, and examples
  for `conclave:usecase`, `conclave:eventmodel`, and `conclave:tasks` fenced code blocks.
  Use when emitting or parsing any `conclave:*` block — read the relevant reference file
  before generating output. Other skills (req, arq, org, plan) depend on this for output format.
---

# Conclave Blocks

Conclave extends markdown with custom fenced code blocks using the `conclave:` language prefix. The chat UI renders them as rich interactive components instead of plain code.

## Block Types

| Block | Rendered? | Reference | Emitted by | Consumed by |
|-------|-----------|-----------|------------|-------------|
| `conclave:usecase` | Yes — interactive card | [references/usecase.md](references/usecase.md) | req | arq, plan |
| `conclave:eventmodel` | Yes — multi-column diagram | [references/eventmodel.md](references/eventmodel.md) | arq | plan |
| `conclave:tasks` | No — machine-readable only | [references/tasks.md](references/tasks.md) | org | orc |

Before emitting any block, read its reference file for the schema, field definitions, and examples.

Before parsing blocks from an existing `analysis.md` or `tasks.md`, read the relevant reference file to understand the structure.
