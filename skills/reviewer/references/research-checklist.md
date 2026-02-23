# Researcher — Review Checklist

Criteria for evaluating `research.md`.

## Structure

1. **Has a context opener.** The file opens with a brief description of what is being explored and why.
2. **Has a Findings section.** Concrete discoveries, observations, or analysis — not just questions.
3. **Has an Open Questions section.** Unresolved issues are captured explicitly, not left implicit.
4. **Has a Leanings section.** Where the thinking is trending — decisions that feel settled or directions that emerged.

## Findings Quality

5. **Findings are specific.** Claims reference concrete evidence — codebase behavior, tool comparisons, user statements — not vague generalizations.
6. **Findings are organized.** Grouped by sub-topic, question, or theme — not a stream-of-consciousness dump.
7. **Trade-offs are surfaced.** Where multiple approaches exist, the trade-offs between them are articulated (not just "option A and option B exist").
8. **Codebase references are grounded.** If findings reference existing code or architecture, they cite specific files, modules, or patterns — not hand-wavy "the current system does X".

## Open Questions

9. **Questions are actionable.** Each open question could plausibly be answered — not rhetorical or too broad ("what is the best approach?").
10. **Questions are scoped.** Questions relate to the specific feature/problem, not tangential concerns.
11. **No secretly-answered questions.** If a question is addressed in the Findings, it shouldn't also appear as Open.

## Leanings

12. **Leanings trace to findings.** Each leaning connects to something discovered during research — not unsupported assertions.
13. **Leanings are decision-shaped.** They express direction ("we should use X because Y") not just observations ("X exists").

## Completeness

14. **Sufficient for /gather-requirements.** A requirements analyst reading only this file would have enough context to produce use cases without re-doing the research.
15. **No transcript residue.** The file reads as a distilled briefing, not a conversation log or raw notes dump.
16. **Scope is clear.** The boundary of what was explored (and what was deliberately excluded) is evident.
