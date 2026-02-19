import type { WsEvent, PermissionOption } from "../server/types.ts";

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

export type PendingPermission = {
  options: PermissionOption[];
  toolName?: string;
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
  fileChanges: FileChangeInfo[];
  currentMode: string;
  planContent: string;
  pendingPermission: PendingPermission | null;
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
  fileChanges: [],
  currentMode: "",
  planContent: "",
  pendingPermission: null,
  isProcessing: false,
  creatingSession: false,
  error: null,
  usage: null,
};

// Transient client-side event (not persisted server-side, not replayed)
type SessionInitiated = { type: "SessionInitiated" };

export type ClientEvent = WsEvent | SessionInitiated;
