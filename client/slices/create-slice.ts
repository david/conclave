import type { AppState, ClientEvent } from "../types.ts";

/** Extract the member of a discriminated union by its `type` field. */
type EventOfType<T extends ClientEvent["type"]> = Extract<ClientEvent, { type: T }>;

/**
 * Factory for creating a slice that handles exactly one event type.
 * Eliminates the boilerplate type guard + early return in every slice.
 */
export function createSlice<T extends ClientEvent["type"]>(
  eventType: T,
  handler: (state: AppState, event: EventOfType<T>) => AppState,
): (state: AppState, event: ClientEvent) => AppState {
  return (state, event) => {
    if (event.type !== eventType) return state;
    return handler(state, event as EventOfType<T>);
  };
}
