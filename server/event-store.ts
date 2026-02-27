import type { DomainEvent, EventPayload, GlobalEventPayload } from "./types.ts";

export type EventListener = (event: DomainEvent) => void;

export class EventStore {
  private events: DomainEvent[] = [];
  private nextSeq = 1;
  private listeners = new Set<EventListener>();

  append(sessionId: string, payload: EventPayload): DomainEvent {
    const event = {
      ...payload,
      sessionId,
      seq: this.nextSeq++,
      timestamp: Date.now(),
    } as DomainEvent;

    this.events.push(event);

    for (const listener of this.listeners) {
      listener(event);
    }

    return event;
  }

  appendReplay(sessionId: string, payload: EventPayload): DomainEvent {
    const event = {
      ...payload,
      sessionId,
      seq: this.nextSeq++,
      timestamp: Date.now(),
    } as DomainEvent;

    this.events.push(event);
    // No listener notification — replay events bypass processors and live WS subscriptions
    return event;
  }

  appendGlobal(payload: GlobalEventPayload): DomainEvent {
    const event = {
      ...payload,
      seq: this.nextSeq++,
      timestamp: Date.now(),
    } as DomainEvent;

    this.events.push(event);

    for (const listener of this.listeners) {
      listener(event);
    }

    return event;
  }

  getAll(): DomainEvent[] {
    return this.events.slice();
  }

  getBySessionId(sessionId: string): DomainEvent[] {
    return this.events.filter((e) => "sessionId" in e && e.sessionId === sessionId);
  }

  getFrom(seq: number): DomainEvent[] {
    return this.events.filter((e) => e.seq >= seq);
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
