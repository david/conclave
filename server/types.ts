import type {
  SessionId,
  ToolCallId,
  ToolKind,
  ToolCallStatus,
  StopReason,
  ToolCallContent,
} from "@agentclientprotocol/sdk";

// --- Shared Types ---

export type ImageAttachment = {
  data: string;      // base64-encoded
  mimeType: string;  // e.g. "image/png"
};

// --- Domain Events ---

// Shared fields stamped by EventStore.append() / appendGlobal()
export type BaseFields = {
  seq: number;
  timestamp: number;
};

// Session events — carry sessionId
export type BaseEvent = BaseFields & {
  sessionId: string;
};

// Global events — no sessionId
export type BaseGlobalEvent = BaseFields;

export type SessionCreated = BaseEvent & {
  type: "SessionCreated";
  sessionId: string;
  name?: string;
};

export type PromptSubmitted = BaseEvent & {
  type: "PromptSubmitted";
  text: string;
  images?: ImageAttachment[];
};

export type AgentText = BaseEvent & {
  type: "AgentText";
  text: string;
};

export type ToolCallStarted = BaseEvent & {
  type: "ToolCallStarted";
  toolCallId: string;
  toolName: string;
  kind?: ToolKind | null;
  input?: unknown;
};

export type ToolCallUpdated = BaseEvent & {
  type: "ToolCallUpdated";
  toolCallId: string;
  status: ToolCallStatus;
  content?: ToolCallContent[] | null;
};

export type ToolCallCompleted = BaseEvent & {
  type: "ToolCallCompleted";
  toolCallId: string;
  status: ToolCallStatus;
  output?: unknown;
};

export type TurnCompleted = BaseEvent & {
  type: "TurnCompleted";
  stopReason: StopReason;
};

export type PlanUpdated = BaseEvent & {
  type: "PlanUpdated";
  entries: Array<{ content: string; status: string; priority: string }>;
};

export type ErrorOccurred = BaseEvent & {
  type: "ErrorOccurred";
  message: string;
};

export type SessionSwitched = BaseEvent & {
  type: "SessionSwitched";
  epoch: string;
};

export type SessionDiscovered = BaseEvent & {
  type: "SessionDiscovered";
  name: string;
  title: string | null;
  createdAt: number;
};

export type SessionLoaded = BaseEvent & {
  type: "SessionLoaded";
};

export type AgentThought = BaseEvent & {
  type: "AgentThought";
  text: string;
};

export type UsageUpdated = BaseEvent & {
  type: "UsageUpdated";
  size: number;
  used: number;
  costAmount?: number;
  costCurrency?: string;
};

export type SessionInfoUpdated = BaseEvent & {
  type: "SessionInfoUpdated";
  title?: string | null;
  updatedAt?: string | null;
};

export type CancellationRequested = BaseEvent & {
  type: "CancellationRequested";
};

export type NextBlockInitiated = BaseEvent & {
  type: "NextBlockInitiated";
  currentSessionId: string;
  label: string;
  commandText: string;
  metaContext: string;
};

export type MetaContextEnsured = BaseEvent & {
  type: "MetaContextEnsured";
  metaContextId: string;
  metaContextName: string;
  originSessionId: string;
  commandText: string;
  created: boolean;
};

export type SessionAddedToMetaContext = BaseEvent & {
  type: "SessionAddedToMetaContext";
  metaContextId: string;
  commandText: string;
};

// --- Spec System ---

export type SpecPhase = "research" | "analysis" | "breakdown" | "implementation";

export type SpecInfo = {
  name: string;
  description: string | null;
  phase: SpecPhase | null;
  type: "epic" | "spec";
  epic: string | null;
};

export type SpecListUpdated = BaseGlobalEvent & {
  type: "SpecListUpdated";
  specs: SpecInfo[];
};

// --- Git Status ---

export type GitFileStatus = " " | "M" | "A" | "D" | "R" | "?" | "!";

export type GitFileEntry = {
  path: string;
  indexStatus: GitFileStatus;
  workTreeStatus: GitFileStatus;
  linesAdded: number;
  linesDeleted: number;
};

export type GitStatusUpdated = BaseGlobalEvent & {
  type: "GitStatusUpdated";
  files: GitFileEntry[];
};

export type MetaContextInfo = {
  id: string;
  name: string;
  sessionIds: string[];
};

export type SessionListEvent = {
  type: "SessionList";
  sessions: Array<{ sessionId: string; name: string; title: string | null; firstPrompt: string | null }>;
  metaContexts: MetaContextInfo[];
  seq: -1;
  timestamp: number;
};

export type SessionEvent =
  | SessionCreated
  | PromptSubmitted
  | AgentText
  | AgentThought
  | ToolCallStarted
  | ToolCallUpdated
  | ToolCallCompleted
  | TurnCompleted
  | PlanUpdated
  | ErrorOccurred
  | SessionSwitched
  | SessionDiscovered
  | SessionLoaded
  | UsageUpdated
  | SessionInfoUpdated
  | CancellationRequested
  | NextBlockInitiated
  | MetaContextEnsured
  | SessionAddedToMetaContext;

// --- Service Status ---

export type ServiceProcess = {
  name: string;
  status: string;
  uptime: string;
};

export type ServiceStatusUpdated = BaseGlobalEvent & {
  type: "ServiceStatusUpdated";
  available: boolean;
  services: ServiceProcess[];
};

export type GlobalEvent = SpecListUpdated | GitStatusUpdated | ServiceStatusUpdated;

export type DomainEvent = SessionEvent | GlobalEvent;

// Events sent over WebSocket (includes meta-events not stored in EventStore)
export type WsEvent = DomainEvent | SessionListEvent;

export type DomainEventType = DomainEvent["type"];

// Distributive Omit that preserves discriminated union members
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

// Payload without seq/timestamp/sessionId (used when appending — sessionId passed separately)
export type EventPayload = DistributiveOmit<SessionEvent, "seq" | "timestamp" | "sessionId">;

// Payload for global events (no sessionId to strip)
export type GlobalEventPayload = DistributiveOmit<GlobalEvent, "seq" | "timestamp">;

// --- WS Commands (browser → server) ---

export type SubmitPromptCommand = {
  command: "submit_prompt";
  text: string;
  images?: ImageAttachment[];
};

export type CancelCommand = {
  command: "cancel";
};

export type CreateSessionCommand = {
  command: "create_session";
};

export type SwitchSessionCommand = {
  command: "switch_session";
  sessionId: string;
};

export type NextBlockClickCommand = {
  command: "next_block_click";
  label: string;
  commandText: string;
  metaContext: string;
};

export type WsCommand = SubmitPromptCommand | CancelCommand | CreateSessionCommand | SwitchSessionCommand | NextBlockClickCommand;

// --- Server Commands (dispatch) ---

export type CreateSessionCmd = { type: "CreateSession" };
export type SwitchSessionCmd = { type: "SwitchSession" };
export type LoadSessionCmd = { type: "LoadSession" };
export type DiscoverSessionCmd = { type: "DiscoverSession"; name: string; title: string | null; createdAt: number };
export type SubmitPromptCmd = { type: "SubmitPrompt"; text: string; images?: ImageAttachment[] };
export type CancelPromptCmd = { type: "CancelPrompt" };
export type NextBlockClickCmd = { type: "NextBlockClick"; currentSessionId: string; label: string; commandText: string; metaContext: string };
export type EnsureMetaContextCmd = { type: "EnsureMetaContext"; originSessionId: string; metaContextName: string; commandText: string };
export type AddSessionToMetaContextCmd = { type: "AddSessionToMetaContext"; sessionId: string; metaContextId: string; commandText: string };

export type RecordAgentTextCmd = { type: "RecordAgentText"; text: string };
export type RecordAgentThoughtCmd = { type: "RecordAgentThought"; text: string };
export type RecordToolCallStartedCmd = { type: "RecordToolCallStarted"; toolCallId: string; toolName: string; kind?: ToolKind | null; input?: unknown };
export type RecordToolCallUpdatedCmd = { type: "RecordToolCallUpdated"; toolCallId: string; status: ToolCallStatus; content?: ToolCallContent[] | null };
export type RecordToolCallCompletedCmd = { type: "RecordToolCallCompleted"; toolCallId: string; status: ToolCallStatus; output?: unknown };
export type RecordPlanUpdatedCmd = { type: "RecordPlanUpdated"; entries: Array<{ content: string; status: string; priority: string }> };
export type RecordUsageUpdatedCmd = { type: "RecordUsageUpdated"; size: number; used: number; costAmount?: number; costCurrency?: string };
export type RecordSessionInfoUpdatedCmd = { type: "RecordSessionInfoUpdated"; title?: string | null; updatedAt?: string | null };
export type CompleteTurnCmd = { type: "CompleteTurn"; stopReason: StopReason };
export type RecordErrorCmd = { type: "RecordError"; message: string };

export type ServerCommand =
  | CreateSessionCmd
  | SwitchSessionCmd
  | LoadSessionCmd
  | DiscoverSessionCmd
  | SubmitPromptCmd
  | CancelPromptCmd
  | NextBlockClickCmd
  | EnsureMetaContextCmd
  | AddSessionToMetaContextCmd
  | RecordAgentTextCmd
  | RecordAgentThoughtCmd
  | RecordToolCallStartedCmd
  | RecordToolCallUpdatedCmd
  | RecordToolCallCompletedCmd
  | RecordPlanUpdatedCmd
  | RecordUsageUpdatedCmd
  | RecordSessionInfoUpdatedCmd
  | CompleteTurnCmd
  | RecordErrorCmd;
