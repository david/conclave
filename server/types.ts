import type {
  SessionId,
  ToolCallId,
  ToolKind,
  ToolCallStatus,
  StopReason,
  ToolCallContent,
} from "@agentclientprotocol/sdk";

// --- Domain Events ---

export type BaseEvent = {
  seq: number;
  timestamp: number;
  sessionId: string;
};

export type SessionCreated = BaseEvent & {
  type: "SessionCreated";
  sessionId: string;
};

export type PromptSubmitted = BaseEvent & {
  type: "PromptSubmitted";
  text: string;
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

export type ModeChanged = BaseEvent & {
  type: "ModeChanged";
  modeId: string;
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

export type SessionListEvent = {
  type: "SessionList";
  sessions: Array<{ sessionId: string; name: string; title: string | null; firstPrompt: string | null }>;
  seq: -1;
  timestamp: number;
};

export type DomainEvent =
  | SessionCreated
  | PromptSubmitted
  | AgentText
  | ToolCallStarted
  | ToolCallUpdated
  | ToolCallCompleted
  | TurnCompleted
  | PlanUpdated
  | ModeChanged
  | PermissionRequested
  | ErrorEvent
  | SessionSwitched;

// Events sent over WebSocket (includes meta-events not stored in EventStore)
export type WsEvent = DomainEvent | SessionListEvent;

export type DomainEventType = DomainEvent["type"];

// Distributive Omit that preserves discriminated union members
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

// Payload without seq/timestamp/sessionId (used when appending — sessionId passed separately)
export type EventPayload = DistributiveOmit<DomainEvent, "seq" | "timestamp" | "sessionId">;

// --- Commands (browser → server) ---

export type SubmitPromptCommand = {
  command: "submit_prompt";
  text: string;
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
