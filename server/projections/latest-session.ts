import type { EventStore } from "../event-store.ts";
import type { DomainEvent } from "../types.ts";
import { Projection } from "../projection.ts";
import { initialLatestSessionState, type LatestSessionState } from "../server-state.ts";

function latestSessionReducer(state: LatestSessionState, event: DomainEvent): LatestSessionState {
  switch (event.type) {
    case "SessionCreated":
    case "SessionDiscovered":
      return { latestSessionId: event.sessionId };
    default:
      return state;
  }
}

/** Read model tracking which session new WS connections should get. */
export function createLatestSessionProjection(store: EventStore): Projection<LatestSessionState> {
  return new Projection(store, initialLatestSessionState, latestSessionReducer);
}
