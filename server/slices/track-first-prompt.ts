import type { DomainEvent } from "../types.ts";
import type { SessionRegistryState } from "../server-state.ts";

/** PromptSubmitted → sets firstPrompt on the session if not already set. */
export function trackFirstPromptSlice(state: SessionRegistryState, event: DomainEvent): SessionRegistryState {
  if (event.type !== "PromptSubmitted") return state;

  const existing = state.sessions.get(event.sessionId);
  if (!existing || existing.firstPrompt) return state;

  const sessions = new Map(state.sessions);
  sessions.set(event.sessionId, { ...existing, firstPrompt: event.text });

  return { ...state, sessions };
}
