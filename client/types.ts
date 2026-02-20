import type { WsEvent, ModeClientInfo } from "../server/types.ts";

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

export type FileChangeAction = "modified" | "deleted";

export type FileChangeInfo = {
  filePath: string;
  action: FileChangeAction;
  toolCallId: string;
  status: string;
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

export type UsageInfo = {
  size: number;
  used: number;
  costAmount?: number;
  costCurrency?: string;
};

export type AppState = {
  sessionId: string | null;
  sessions: SessionInfo[];
  availableModes: ModeClientInfo[];
  messages: Message[];
  streamingContent: ContentBlock[];
  planEntries: PlanEntryInfo[];
  useCases: UseCase[];
  fileChanges: FileChangeInfo[];
  currentMode: string;
  isProcessing: boolean;
  creatingSession: boolean;
  error: string | null;
  usage: UsageInfo | null;
};

export const initialState: AppState = {
  sessionId: null,
  sessions: [],
  availableModes: [],
  messages: [],
  streamingContent: [],
  planEntries: [],
  useCases: [],
  fileChanges: [],
  currentMode: "chat",
  isProcessing: false,
  creatingSession: false,
  error: null,
  usage: null,
};

// Transient client-side event (not persisted server-side, not replayed)
type SessionInitiated = { type: "SessionInitiated" };

export type ClientEvent = WsEvent | SessionInitiated;
