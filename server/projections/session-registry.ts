import type { EventStore } from "../event-store.ts";
import type { DomainEvent } from "../types.ts";
import { Projection } from "../projection.ts";
import { initialSessionRegistryState, type SessionRegistryState } from "../server-state.ts";
import { createSessionSlice } from "../slices/create-session/projector.ts";
import { discoverSessionSlice } from "../slices/discover-session/projector.ts";
import { loadSessionSlice } from "../slices/load-session/projector.ts";
import { trackFirstPromptSlice } from "../slices/submit-prompt/projector.ts";
import { updateTitleSlice } from "../slices/record-session-info-updated/projector.ts";

type Slice = (state: SessionRegistryState, event: DomainEvent) => SessionRegistryState;

const projectors: Slice[] = [
  createSessionSlice,
  discoverSessionSlice,
  loadSessionSlice,
  trackFirstPromptSlice,
  updateTitleSlice,
];

function sessionRegistryReducer(state: SessionRegistryState, event: DomainEvent): SessionRegistryState {
  return projectors.reduce((s, p) => p(s, event), state);
}

/** Read model for command-side session lookups. */
export function createSessionRegistry(store: EventStore): Projection<SessionRegistryState> {
  return new Projection(store, initialSessionRegistryState, sessionRegistryReducer);
}
