import type { DomainEvent } from "../../types.ts";
import type { MetaContextRegistryState } from "../../server-state.ts";

/** MetaContextEnsured → adds entry to contexts map and nameIndex when created is true. */
export function metaContextEnsuredSlice(state: MetaContextRegistryState, event: DomainEvent): MetaContextRegistryState {
  if (event.type !== "MetaContextEnsured") return state;
  if (!event.created) return state;

  const contexts = new Map(state.contexts);
  contexts.set(event.metaContextId, {
    id: event.metaContextId,
    name: event.metaContextName,
    sessionIds: [],
  });

  const nameIndex = new Map(state.nameIndex);
  nameIndex.set(event.metaContextName, event.metaContextId);

  return { contexts, nameIndex };
}
