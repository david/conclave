import type { DomainEvent } from "../types.ts";
import type { SessionRegistryState } from "../server-state.ts";
import { nextNewSessionName } from "./utils.ts";

/** SessionCreated → adds session entry with loaded: true, increments counter. */
export function createSessionSlice(state: SessionRegistryState, event: DomainEvent): SessionRegistryState {
  if (event.type !== "SessionCreated") return state;

  const counter = state.sessionCounter + 1;
  const name = event.name ?? nextNewSessionName(state);
  const sessions = new Map(state.sessions);
  sessions.set(event.sessionId, {
    sessionId: event.sessionId,
    name,
    title: null,
    firstPrompt: null,
    loaded: true,
    createdAt: event.timestamp,
  });

  return { sessions, sessionCounter: counter };
}
