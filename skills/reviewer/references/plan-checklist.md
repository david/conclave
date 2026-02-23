# Planner — Review Checklist

Criteria for evaluating `breakdown.md`.

## Structure

1. **Has an opening summary.** A one-paragraph overview of what will be built and the approach.
2. **Has a New Types section (if needed).** Shared types, events, state shapes that span multiple UCs are defined once at the top — not duplicated per UC section.
3. **Has UC sections.** At least one `## UC-X: ...` section (or combined `## UC-1 + UC-2: ...`).
4. **UC IDs match analysis.** Every UC ID referenced in breakdown.md exists in the spec's analysis. No phantom UCs.

## UC Sections

5. **Each section has a Files list.** Specific file paths with create/modify intent and a brief rationale.
6. **Each section has Steps.** Numbered, concrete implementation steps.
7. **Each section has Tests.** At least one test scenario with description and expected outcome.

## Concreteness

8. **File paths are specific.** Actual paths like `server/slices/create-session.ts`, not vague references like "the slice file" or "the relevant module".
9. **Function/type names are specific.** Steps name actual functions, types, or event names — not "add a handler" or "create a type".
10. **Steps are actionable.** Each step describes a single, implementable action. A developer reading the step should know exactly what to write.
11. **No forward references.** A UC section doesn't reference code or types that are defined in a later section and don't already exist in the codebase. (Exception: the New Types section, which everything may reference.)

## Dependency Order

12. **Respects UC dependencies.** If UC-3 depends on UC-1, UC-1's section appears before UC-3's section.
13. **Groupings are justified.** If UCs are combined into a single section (`UC-1 + UC-2`), they touch the same files and are cleaner together. Unrelated UCs are not lumped.

## Test Coverage

14. **Every UC has test scenarios.** No UC section is missing its Tests subsection.
15. **Tests are specific.** Each scenario names what is being tested and the expected outcome — not "test that it works" but "submitting an empty prompt returns a validation error".
16. **Tests follow project conventions.** Co-located `*.test.ts` files, Bun test runner, etc. (inferred from the plan's file paths and descriptions).

## Quality

17. **Mirrors existing patterns.** The plan references and extends existing architectural patterns (slices, projections, event types) rather than inventing new ones.
18. **No gold plating.** Steps implement what the UCs require — no extra features, error handling for impossible states, or speculative abstractions.
19. **Buildable in order.** Sections can be implemented top-to-bottom without getting stuck. Each section produces a working increment.
20. **Calibrated to scope.** A 3-UC spec has a concise plan. A 10-UC spec has a longer one. The plan's length matches the feature's complexity.
