import type { WsEvent } from "../server/types.ts";

export type ToolCallInfo = {
  toolCallId: string;
  toolName: string;
  kind?: string | null;
  input?: unknown;
  status: string;
  content?: unknown;
  output?: unknown;
};

export type SessionInfo = {
  sessionId: string;
  name: string;
  title: string | null;
  firstPrompt: string | null;
};

export type PlanEntryInfo = {
  content: string;
  status: string;
  priority: string;
};

export type UseCasePriority = "high" | "medium" | "low";

export type UseCase = {
  id: string;
  name: string;
  actor: string;
  summary: string;
  given: string[];
  when: string[];
  then: string[];
  priority: UseCasePriority;
  dependencies?: string[];
};

export type EventModelNodeFields = Record<string, string>;

export type EventModelCommand = {
  name: string;
  new?: boolean;
  fields?: EventModelNodeFields;
  feeds?: string[];
};

export type EventModelEvent = {
  name: string;
  new?: boolean;
  fields?: EventModelNodeFields;
  feeds?: string[];
};

export type EventModelProjection = {
  name: string;
  new?: boolean;
  fields?: EventModelNodeFields;
  feeds?: string[];
};

export type EventModelSlice = {
  slice: string;
  label?: string;
  screen?: string;
  command?: EventModelCommand;
  events?: EventModelEvent[];
  projections?: EventModelProjection[];
  sideEffects?: string[];
};

export type GitFileEntry = {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
  linesAdded: number;
  linesDeleted: number;
};

export type TextBlock = { type: "text"; text: string };
export type ImageBlock = { type: "image"; data: string; mimeType: string };
export type ToolCallBlock = { type: "tool_call"; toolCall: ToolCallInfo };
export type ThoughtBlock = { type: "thought"; text: string };
export type ContentBlock = TextBlock | ImageBlock | ToolCallBlock | ThoughtBlock;

export type Message = {
  role: "user" | "assistant";
  content: ContentBlock[];
};

export type SpecInfo = {
  name: string;
  description: string | null;
  phase: "research" | "analysis" | "implementation" | null;
  type: "epic" | "spec";
  epic: string | null;
};

export type ServiceProcess = {
  name: string;
  status: string;
  uptime: string;
};

export type UsageInfo = {
  size: number;
  used: number;
  costAmount?: number;
  costCurrency?: string;
};

export type AppState = {
  sessionId: string | null;
  sessions: SessionInfo[];
  messages: Message[];
  streamingContent: ContentBlock[];
  planEntries: PlanEntryInfo[];
  gitFiles: GitFileEntry[];
  specs: SpecInfo[];
  services: ServiceProcess[];
  servicesAvailable: boolean;
  isProcessing: boolean;
  creatingSession: boolean;
  error: string | null;
  usage: UsageInfo | null;
};

export const initialState: AppState = {
  sessionId: null,
  sessions: [],
  messages: [],
  streamingContent: [],
  planEntries: [],
  gitFiles: [],
  specs: [],
  services: [],
  servicesAvailable: true,
  isProcessing: false,
  creatingSession: false,
  error: null,
  usage: null,
};

// Transient client-side event (not persisted server-side, not replayed)
type SessionInitiated = { type: "SessionInitiated" };

// Explicit type to ensure createSlice("GitStatusUpdated", ...) compiles
// even if the server types haven't been updated yet.
type GitStatusUpdatedEvent = { type: "GitStatusUpdated"; files: GitFileEntry[]; seq: number; timestamp: number };

export type ClientEvent = WsEvent | SessionInitiated | GitStatusUpdatedEvent;
