import type { EventStore } from "../event-store.ts";
import { Projection } from "../projection.ts";
import { initialSessionRegistryState, type SessionRegistryState } from "../server-state.ts";
import { sessionRegistryReducer } from "../slices/index.ts";

/** Read model for command-side session lookups. */
export function createSessionRegistry(store: EventStore): Projection<SessionRegistryState> {
  return new Projection(store, initialSessionRegistryState, sessionRegistryReducer);
}
