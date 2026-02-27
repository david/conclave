import type { DomainEvent } from "../types.ts";
import type { MetaContextRegistryState } from "../server-state.ts";
import { metaContextEnsuredSlice } from "./meta-context-created.ts";
import { sessionAddedToMetaContextSlice } from "./session-added-to-meta-context.ts";

type Slice = (state: MetaContextRegistryState, event: DomainEvent) => MetaContextRegistryState;

const slices: Slice[] = [
  metaContextEnsuredSlice,
  sessionAddedToMetaContextSlice,
];

/** Runs all meta-context registry slices sequentially. */
export function metaContextRegistryReducer(state: MetaContextRegistryState, event: DomainEvent): MetaContextRegistryState {
  return slices.reduce((s, slice) => slice(s, event), state);
}
