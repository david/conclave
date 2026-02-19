// Server-side domain state types used by projections and slices.

export type SessionMeta = {
  sessionId: string;
  name: string;
  title: string | null;
  firstPrompt: string | null;
  loaded: boolean;
  createdAt: number;
};

// SessionRegistry read model state
export type SessionRegistryState = {
  sessions: Map<string, SessionMeta>;
  sessionCounter: number;
};

export const initialSessionRegistryState: SessionRegistryState = {
  sessions: new Map(),
  sessionCounter: 0,
};

// LatestSession read model state
export type LatestSessionState = {
  latestSessionId: string | null;
};

export const initialLatestSessionState: LatestSessionState = {
  latestSessionId: null,
};
