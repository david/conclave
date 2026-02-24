# Planner — Review Checklist

Criteria for evaluating `breakdown.md`.

The planner supports two modes: **use-case mode** (sections organized by UC ID from analysis.md) and **research mode** (sections organized by topic from research.md). Criteria below apply to both unless marked with **(UC only)** or **(research only)**.

## Structure

1. **Has an opening summary.** A one-paragraph overview of what will be built and the approach.
2. **Has a New Types section (if needed).** Shared types, events, state shapes that span multiple sections are defined once at the top — not duplicated per section. In research mode, this section may be omitted if no shared types are needed.
3. **Has implementation sections.** At least one `## UC-X: ...` section (UC mode) or `## <Topic Name>` section (research mode).
4. **Section IDs match source.** **(UC only)** Every UC ID referenced in breakdown.md exists in the spec's analysis. No phantom UCs. **(Research only)** Every topic section traces to a decision or finding in research.md.

## Sections

5. **Each section has a Files list.** Specific file paths with create/modify intent and a brief rationale.
6. **Each section has Steps.** Numbered, concrete implementation steps.
7. **Each section has Tests.** At least one test scenario with description and expected outcome.

## Concreteness

8. **File paths are specific.** Actual paths like `server/slices/create-session.ts` or `client/style.css`, not vague references like "the slice file" or "the relevant module".
9. **Function/type names are specific.** Steps name actual functions, types, CSS classes, or event names — not "add a handler" or "update the styles".
10. **Steps are actionable.** Each step describes a single, implementable action. A developer reading the step should know exactly what to write.
11. **No forward references.** A section doesn't reference code or types that are defined in a later section and don't already exist in the codebase. (Exception: the New Types section, which everything may reference.)

## Dependency Order

12. **Respects dependencies.** If a section depends on another (UC dependency or topic prerequisite), the prerequisite section appears first.
13. **Groupings are justified.** If sections are combined (e.g., `UC-1 + UC-2` or two related topics), they touch the same files and are cleaner together. Unrelated items are not lumped.

## Test Coverage

14. **Every section has test scenarios.** No section is missing its Tests subsection.
15. **Tests are specific.** Each scenario names what is being tested and the expected outcome — not "test that it works" but "submitting an empty prompt returns a validation error" or "at 600px viewport, only one pane is visible".
16. **Tests follow project conventions.** Co-located `*.test.ts` files, Bun test runner, etc. (inferred from the plan's file paths and descriptions).

## Quality

17. **Mirrors existing patterns.** The plan references and extends existing architectural patterns (slices, projections, event types, CSS conventions) rather than inventing new ones.
18. **No gold plating.** Steps implement what the source document requires — no extra features, error handling for impossible states, or speculative abstractions.
19. **Buildable in order.** Sections can be implemented top-to-bottom without getting stuck. Each section produces a working increment.
20. **Calibrated to scope.** A 3-section spec has a concise plan. A 10-section spec has a longer one. The plan's length matches the feature's complexity.
