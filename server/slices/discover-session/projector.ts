import type { DomainEvent } from "../../types.ts";
import type { SessionRegistryState } from "../../server-state.ts";

/** SessionDiscovered → adds session entry with loaded: false, increments counter. */
export function discoverSessionSlice(state: SessionRegistryState, event: DomainEvent): SessionRegistryState {
  if (event.type !== "SessionDiscovered") return state;

  const counter = state.sessionCounter + 1;
  const sessions = new Map(state.sessions);
  sessions.set(event.sessionId, {
    sessionId: event.sessionId,
    name: event.name,
    title: event.title,
    firstPrompt: null,
    loaded: false,
    createdAt: event.createdAt,
  });

  return { sessions, sessionCounter: counter };
}
