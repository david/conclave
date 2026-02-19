import type { EventStore } from "./event-store.ts";
import type { DomainEvent } from "./types.ts";

export type Reducer<S> = (state: S, event: DomainEvent) => S;

/**
 * A read model that subscribes to an EventStore and maintains derived state.
 * Replays all existing events on construction, then stays up-to-date via subscription.
 */
export class Projection<S> {
  private state: S;

  constructor(store: EventStore, initialState: S, reducer: Reducer<S>) {
    this.state = initialState;

    // Replay existing events
    for (const event of store.getAll()) {
      this.state = reducer(this.state, event);
    }

    // Subscribe to new events
    store.subscribe((event) => {
      this.state = reducer(this.state, event);
    });
  }

  getState(): S {
    return this.state;
  }
}
