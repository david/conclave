import type { EventStore } from "../event-store.ts";
import type { DomainEvent, SessionListEvent, MetaContextInfo } from "../types.ts";
import type { Projection } from "../projection.ts";
import type { SessionRegistryState } from "../server-state.ts";

const SESSION_AFFECTING_EVENTS = new Set([
  "SessionCreated",
  "SessionDiscovered",
  "PromptSubmitted",
  "SessionInfoUpdated",
  "MetaContextEnsured",
  "SessionAddedToMetaContext",
]);

type MetaContextSource = {
  toMetaContextInfoList(): MetaContextInfo[];
};

/**
 * Reactive projection that triggers a broadcast whenever the session list changes.
 * Derives its data from the SessionRegistry read model rather than maintaining independent state.
 */
export function createSessionListProjection(
  store: EventStore,
  registry: Projection<SessionRegistryState>,
  onChanged: (list: SessionListEvent) => void,
  metaContextRegistry?: MetaContextSource,
): void {
  store.subscribe((event: DomainEvent) => {
    if (SESSION_AFFECTING_EVENTS.has(event.type)) {
      onChanged(buildSessionList(registry, metaContextRegistry));
    }
  });
}

export function buildSessionList(
  registry: Projection<SessionRegistryState>,
  metaContextRegistry?: MetaContextSource,
): SessionListEvent {
  const { sessions } = registry.getState();
  return {
    type: "SessionList",
    sessions: Array.from(sessions.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ sessionId, name, title, firstPrompt }) => ({ sessionId, name, title, firstPrompt })),
    metaContexts: metaContextRegistry?.toMetaContextInfoList() ?? [],
    seq: -1,
    timestamp: Date.now(),
  };
}
