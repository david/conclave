import type { DomainEvent } from "../types.ts";
import type { MetaContextRegistryState } from "../server-state.ts";

/** MetaContextCreated → adds entry to contexts map and nameIndex. */
export function metaContextCreatedSlice(state: MetaContextRegistryState, event: DomainEvent): MetaContextRegistryState {
  if (event.type !== "MetaContextCreated") return state;

  const contexts = new Map(state.contexts);
  contexts.set(event.metaContextId, {
    id: event.metaContextId,
    name: event.name,
    sessionIds: [],
  });

  const nameIndex = new Map(state.nameIndex);
  nameIndex.set(event.name, event.metaContextId);

  return { contexts, nameIndex };
}
