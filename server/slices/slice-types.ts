import type { DomainEvent, EventPayload } from "../types.ts";

/** Emit an event into the store and run processors. Returns the stored event. */
export type EmitFn = (sessionId: string, payload: EventPayload) => Promise<DomainEvent>;

/** Dispatch a follow-on command. */
export type DispatchFn = (sessionId: string, command: import("../types.ts").ServerCommand) => Promise<void>;

/** Bridge operations available to handlers that need ACP interaction. */
export type BridgeLike = {
  createSession(): Promise<string>;
  loadSession(sessionId: string): Promise<void>;
  submitPrompt(sessionId: string, text: string, images?: any, skipPromptEvent?: boolean): Promise<void>;
  cancel(sessionId: string): Promise<void>;
};

/** Processor definition: watches one event type and issues follow-on commands. */
export type Processor = {
  watches: DomainEvent["type"];
  handler: (event: DomainEvent, dispatch: DispatchFn) => void | Promise<void>;
};
