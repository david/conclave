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

export type PermissionOption = {
  optionId: string;
  name: string;
  kind: string;
};

export type PermissionRequested = BaseEvent & {
  type: "PermissionRequested";
  options: PermissionOption[];
  toolName?: string;
  planContent?: string;
};

export type ErrorEvent = BaseEvent & {
  type: "Error";
  message: string;
};

export type SessionSwitched = BaseEvent & {
  type: "SessionSwitched";
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

// --- Spec System ---

export type SpecPhase = "analysis" | "implementation";

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

export type SessionListEvent = {
  type: "SessionList";
  sessions: Array<{ sessionId: string; name: string; title: string | null; firstPrompt: string | null }>;
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
  | PermissionRequested
  | ErrorEvent
  | SessionSwitched
  | SessionDiscovered
  | SessionLoaded
  | UsageUpdated
  | SessionInfoUpdated;

export type GlobalEvent = SpecListUpdated | GitStatusUpdated;

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

// --- Commands (browser → server) ---

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

export type PermissionResponseCommand = {
  command: "permission_response";
  optionId: string;
  feedback?: string;
};

export type Command = SubmitPromptCommand | CancelCommand | CreateSessionCommand | SwitchSessionCommand | PermissionResponseCommand;
