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

export type TextBlock = { type: "text"; text: string };
export type ToolCallBlock = { type: "tool_call"; toolCall: ToolCallInfo };
export type ContentBlock = TextBlock | ToolCallBlock;

export type Message = {
  role: "user" | "assistant";
  content: ContentBlock[];
};

export type PendingPermission = {
  options: PermissionOption[];
  toolName?: string;
};

export type AppState = {
  sessionId: string | null;
  sessions: SessionInfo[];
  messages: Message[];
  streamingContent: ContentBlock[];
  planEntries: PlanEntryInfo[];
  currentMode: string;
  planContent: string;
  pendingPermission: PendingPermission | null;
  isProcessing: boolean;
  error: string | null;
};

export const initialState: AppState = {
  sessionId: null,
  sessions: [],
  messages: [],
  streamingContent: [],
  planEntries: [],
  currentMode: "",
  planContent: "",
  pendingPermission: null,
  isProcessing: false,
  error: null,
};

export function reducer(state: AppState, event: WsEvent): AppState {
  switch (event.type) {
    case "SessionCreated":
      return { ...state, sessionId: event.sessionId };

    case "SessionSwitched":
      return {
        ...initialState,
        sessions: state.sessions,
        sessionId: event.sessionId,
      };

    case "SessionList":
      return { ...state, sessions: event.sessions };

    case "ModeChanged": {
      if (event.modeId === "plan") {
        return {
          ...state,
          currentMode: "plan",
          planContent: "",
          pendingPermission: null,
        };
      }
      return {
        ...state,
        currentMode: event.modeId,
        pendingPermission: null,
      };
    }

    case "PromptSubmitted":
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: "user", content: [{ type: "text", text: event.text }] },
        ],
        isProcessing: true,
        pendingPermission: null,
        error: null,
      };

    case "AgentText": {
      // All agent text goes to streamingContent (chat), even in plan mode.
      // The actual plan document is captured from the plan file via PermissionRequested.
      const content = [...state.streamingContent];
      const last = content[content.length - 1];
      if (last && last.type === "text") {
        content[content.length - 1] = {
          type: "text",
          text: last.text + event.text,
        };
      } else {
        content.push({ type: "text", text: event.text });
      }
      return { ...state, streamingContent: content };
    }

    case "ToolCallStarted": {
      // ExitPlanMode tool call (kind: "switch_mode") in plan mode —
      // don't add to streamingContent (it's not a visible tool call).
      if (state.currentMode === "plan" && event.kind === "switch_mode") {
        return state;
      }

      // Deduplicate: ACP agent sends tool_call twice (stream + message completion)
      const alreadyExists = state.streamingContent.some(
        (block) =>
          block.type === "tool_call" &&
          block.toolCall.toolCallId === event.toolCallId,
      );
      if (alreadyExists) return state;

      const toolCall: ToolCallInfo = {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        kind: event.kind,
        input: event.input,
        status: "pending",
      };

      return {
        ...state,
        streamingContent: [
          ...state.streamingContent,
          { type: "tool_call" as const, toolCall },
        ],
      };
    }

    case "ToolCallUpdated": {
      const content = state.streamingContent.map((block) => {
        if (
          block.type === "tool_call" &&
          block.toolCall.toolCallId === event.toolCallId
        ) {
          return {
            type: "tool_call" as const,
            toolCall: {
              ...block.toolCall,
              status: event.status,
              content: event.content ?? block.toolCall.content,
            },
          };
        }
        return block;
      });
      return { ...state, streamingContent: content };
    }

    case "ToolCallCompleted": {
      const content = state.streamingContent.map((block) => {
        if (
          block.type === "tool_call" &&
          block.toolCall.toolCallId === event.toolCallId
        ) {
          return {
            type: "tool_call" as const,
            toolCall: {
              ...block.toolCall,
              status: event.status,
              output: event.output,
            },
          };
        }
        return block;
      });
      return { ...state, streamingContent: content };
    }

    case "PlanUpdated":
      return { ...state, planEntries: event.entries };

    case "PermissionRequested": {
      return {
        ...state,
        // Plan content comes from the plan file captured by the server
        planContent: event.planContent || state.planContent,
        pendingPermission: {
          options: event.options,
          toolName: event.toolName,
        },
      };
    }

    case "TurnCompleted": {
      const hasContent = state.streamingContent.length > 0;
      const newMessages = hasContent
        ? [
            ...state.messages,
            {
              role: "assistant" as const,
              content: state.streamingContent,
            },
          ]
        : state.messages;

      return {
        ...state,
        messages: newMessages,
        streamingContent: [],
        isProcessing: false,
      };
    }

    case "Error":
      return {
        ...state,
        error: event.message,
        isProcessing: false,
      };

    default:
      return state;
  }
}
