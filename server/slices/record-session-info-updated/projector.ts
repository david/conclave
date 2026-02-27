import type { DomainEvent } from "../../types.ts";
import type { SessionRegistryState } from "../../server-state.ts";

/** SessionInfoUpdated → updates title on the existing session entry. */
export function updateTitleSlice(state: SessionRegistryState, event: DomainEvent): SessionRegistryState {
  if (event.type !== "SessionInfoUpdated") return state;
  if (event.title === undefined) return state;

  const existing = state.sessions.get(event.sessionId);
  if (!existing) return state;

  const sessions = new Map(state.sessions);
  sessions.set(event.sessionId, { ...existing, title: event.title });

  return { ...state, sessions };
}
