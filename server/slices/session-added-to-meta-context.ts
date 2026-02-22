import type { DomainEvent } from "../types.ts";
import type { MetaContextRegistryState } from "../server-state.ts";

/** SessionAddedToMetaContext → appends sessionId to the context's sessionIds array. */
export function sessionAddedToMetaContextSlice(state: MetaContextRegistryState, event: DomainEvent): MetaContextRegistryState {
  if (event.type !== "SessionAddedToMetaContext") return state;

  const existing = state.contexts.get(event.metaContextId);
  if (!existing) return state;

  const contexts = new Map(state.contexts);
  contexts.set(event.metaContextId, {
    ...existing,
    sessionIds: [...existing.sessionIds, event.sessionId],
  });

  return { ...state, contexts };
}
