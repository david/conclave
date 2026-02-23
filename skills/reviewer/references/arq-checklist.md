# Architect — Review Checklist

Criteria for evaluating the `## Event Model` section of `analysis.md` (the `conclave:eventmodel` blocks).

## Structure

1. **Event Model section exists.** An `## Event Model` heading is present after the use cases.
2. **At least one eventmodel block.** The section contains one or more `conclave:eventmodel` fenced code blocks with valid JSON.
3. **Blocks parse as valid JSON.** Each block is well-formed JSON matching the eventmodel schema (slice, label, command, events, projections).

## Coverage

4. **Every UC is covered.** Each use case ID from the Use Cases section appears in at least one eventmodel block's slice (directly or via grouped UCs).
5. **No orphan slices.** Every eventmodel block references at least one UC. No slices exist without a corresponding use case.

## Commands

6. **Each slice has a command.** The `command` field is present and non-empty.
7. **Commands are named concretely.** Actual names like `submit_prompt`, not vague labels like "a command". Should follow existing naming conventions (snake_case for commands).
8. **New vs existing is flagged.** Each command has a `new` boolean indicating whether it already exists or needs to be created.

## Events

9. **Each slice has at least one event.** The `events` array is non-empty.
10. **Events are named concretely.** PascalCase TypeScript type names like `SessionCreated`, not descriptions like "a session event".
11. **New vs existing is flagged.** Each event has a `new` boolean.
12. **Events capture facts, not commands.** Events are past-tense descriptions of what happened (`PromptSubmitted`), not imperative instructions (`SubmitPrompt`).

## Projections

13. **Projections are identified.** The `projections` array lists which read models are updated by each event.
14. **New vs existing is flagged.** Each projection has a `new` boolean.
15. **Projection names are concrete.** Actual class/type names, not descriptions.

## Side Effects

16. **Side effects are listed when present.** WS broadcasts, ACP calls, client slice updates, or other non-event consequences are captured in `sideEffects`.
17. **No side effects masquerading as events.** "Send WebSocket message" is a side effect, not a domain event. Events go in `events`, everything else in `sideEffects`.

## Consistency

18. **Naming follows existing conventions.** Event names match the style of existing events in the codebase (PascalCase, past tense). Command names match existing commands (snake_case). Projection names match existing projections.
19. **No duplicate events across slices.** The same event type doesn't appear in multiple slices with different semantics.
20. **Cross-slice feeds are noted.** If one slice's projection feeds into another slice's command, this dependency is surfaced (via `feeds` or in the description).

## Calibration

21. **Proportional to scope.** A 3-UC spec shouldn't have 10 slices. A simple CRUD feature doesn't need complex event choreography.
22. **No speculative infrastructure.** Every event, projection, and command traces back to a UC's needs. No "we might need this later" artifacts.
