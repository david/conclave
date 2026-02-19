import type { DomainEvent } from "../types.ts";
import type { SessionRegistryState } from "../server-state.ts";

/** SessionLoaded → sets loaded: true on the existing session entry. */
export function loadSessionSlice(state: SessionRegistryState, event: DomainEvent): SessionRegistryState {
  if (event.type !== "SessionLoaded") return state;

  const existing = state.sessions.get(event.sessionId);
  if (!existing) return state;

  const sessions = new Map(state.sessions);
  sessions.set(event.sessionId, { ...existing, loaded: true });

  return { ...state, sessions };
}
