import type { ClientEvent, SessionInfo } from "../types.ts";

export type SessionsState = {
  sessionId: string | null;
  sessions: SessionInfo[];
  creatingSession: boolean;
};

export const initialSessionsState: SessionsState = {
  sessionId: null,
  sessions: [],
  creatingSession: false,
};

export function sessionsReducer(state: SessionsState, event: ClientEvent): SessionsState {
  switch (event.type) {
    case "SessionInitiated":
      return { ...state, creatingSession: true };

    case "SessionCreated":
      return { ...state, sessionId: event.sessionId, creatingSession: false };

    case "SessionList":
      return { ...state, sessions: event.sessions };

    case "SessionInfoUpdated": {
      const updatedSessions = state.sessions.map((s) =>
        s.sessionId === event.sessionId
          ? { ...s, title: event.title ?? s.title }
          : s,
      );
      return { ...state, sessions: updatedSessions };
    }

    default:
      return state;
  }
}
