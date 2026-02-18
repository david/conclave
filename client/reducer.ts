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

export type Message = {
  role: "user" | "assistant";
  text: string;
  toolCalls?: ToolCallInfo[];
};

export type AppState = {
  sessionId: string | null;
  sessions: SessionInfo[];
  messages: Message[];
  currentAgentText: string;
  activeToolCalls: Map<string, ToolCallInfo>;
  isProcessing: boolean;
  error: string | null;
};

export const initialState: AppState = {
  sessionId: null,
  sessions: [],
  messages: [],
  currentAgentText: "",
  activeToolCalls: new Map(),
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

    case "PromptSubmitted":
      return {
        ...state,
        messages: [...state.messages, { role: "user", text: event.text }],
        isProcessing: true,
        error: null,
      };

    case "AgentText":
      return {
        ...state,
        currentAgentText: state.currentAgentText + event.text,
      };

    case "ToolCallStarted": {
      const newMap = new Map(state.activeToolCalls);
      newMap.set(event.toolCallId, {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        kind: event.kind,
        input: event.input,
        status: "pending",
      });
      return { ...state, activeToolCalls: newMap };
    }

    case "ToolCallUpdated": {
      const newMap = new Map(state.activeToolCalls);
      const existing = newMap.get(event.toolCallId);
      if (existing) {
        newMap.set(event.toolCallId, {
          ...existing,
          status: event.status,
          content: event.content ?? existing.content,
        });
      }
      return { ...state, activeToolCalls: newMap };
    }

    case "ToolCallCompleted": {
      const newMap = new Map(state.activeToolCalls);
      const existing = newMap.get(event.toolCallId);
      if (existing) {
        newMap.set(event.toolCallId, {
          ...existing,
          status: event.status,
          output: event.output,
        });
      }
      return { ...state, activeToolCalls: newMap };
    }

    case "TurnCompleted": {
      // Flush accumulated text and tool calls into a finalized message
      const toolCalls = Array.from(state.activeToolCalls.values());
      const hasContent =
        state.currentAgentText.length > 0 || toolCalls.length > 0;

      const newMessages = hasContent
        ? [
            ...state.messages,
            {
              role: "assistant" as const,
              text: state.currentAgentText,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            },
          ]
        : state.messages;

      return {
        ...state,
        messages: newMessages,
        currentAgentText: "",
        activeToolCalls: new Map(),
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
