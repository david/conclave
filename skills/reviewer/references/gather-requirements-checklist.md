# Requirements Analyst — Review Checklist

Criteria for evaluating `analysis.md` (use cases and decisions sections).

## Structure

1. **Has a summary paragraph.** The file opens with a one-paragraph summary of what the feature does and why.
2. **Has a Decisions section.** Design choices, conventions, and constraints are captured separately from use cases.
3. **Decisions are not disguised use cases.** Each decision lacks a concrete actor action (no When clause). If it has a When, it should be a use case.
4. **Use cases are present.** At least one use case is defined under `## Use Cases`.

## Use Case Completeness

5. **Each UC has an ID.** Format: `UC-N` with sequential numbering.
6. **Each UC has a named actor.** Not "the system" or "someone" — a specific, reusable actor name.
7. **Actor names are consistent.** The same actor is referred to by the same name across all use cases.
8. **Each UC has a summary.** One sentence describing the interaction.
9. **Each UC has Given (preconditions).** Preconditions are specific and testable — "User is logged in" not "User exists".
10. **Each UC has When (action steps).** At least one concrete actor action. Steps are sequential and unambiguous.
11. **Each UC has Then (outcomes).** At least one observable, testable outcome. Not "system handles it" — what specifically happens?
12. **Each UC has a priority.** One of: High, Medium, Low.

## Atomicity and Independence

13. **Use cases are atomic.** Each UC describes a single, cohesive interaction that can be developed and tested independently. A UC that bundles multiple distinct actor flows should be split.
14. **Dependencies are explicit.** If UC-3 requires UC-1 to be completed first, `depends on UC-1` appears in the heading or body.
15. **No circular dependencies.** The dependency graph is a DAG — no cycles.

## Ordering and Priority

16. **Happy paths come first.** Primary success scenarios appear before alternative flows and error cases.
17. **Independent UCs precede dependents.** UCs with no dependencies appear before those that depend on them.
18. **Priority is realistic.** Not everything is High. If all UCs are High, the prioritization is meaningless.

## Quality

19. **No implementation leakage.** Requirements describe *what*, not *how*. No file paths, function names, SQL clauses, or technology choices in When/Then (those belong in Decisions or downstream artifacts).
20. **No gold plating.** Every UC traces back to something the user asked for or a reasonable edge case thereof. No speculative features.
21. **Calibrated to scope.** A small feature has 2–4 UCs. A medium feature has 5–10. If there are 15 UCs for a toggle button, the analysis is over-engineered.
22. **Then clauses are testable.** Each outcome can be verified by a test — it's specific enough to assert against.
