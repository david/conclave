import type { ClientEvent, AppState, ContentBlock, ToolCallInfo, Message } from "../types.ts";

export type MessagesState = {
  messages: Message[];
  streamingContent: ContentBlock[];
  isProcessing: boolean;
};

export const initialMessagesState: MessagesState = {
  messages: [],
  streamingContent: [],
  isProcessing: false,
};

export function messagesReducer(
  state: MessagesState,
  event: ClientEvent,
  fullState: Readonly<AppState>,
): MessagesState {
  switch (event.type) {
    case "PromptSubmitted": {
      const userContent: ContentBlock[] = [];
      if (event.images?.length) {
        for (const img of event.images) {
          userContent.push({ type: "image", data: img.data, mimeType: img.mimeType });
        }
      }
      if (event.text) {
        userContent.push({ type: "text", text: event.text });
      }
      // Merge with preceding user message if it exists and has no text yet (replay image+text chunks)
      const prevMessages = [...state.messages];
      const lastMsg = prevMessages[prevMessages.length - 1];
      if (lastMsg && lastMsg.role === "user" && state.isProcessing) {
        lastMsg.content = [...lastMsg.content, ...userContent];
        return { ...state, messages: prevMessages, isProcessing: true };
      }
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: "user", content: userContent },
        ],
        isProcessing: true,
      };
    }

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

    case "AgentThought": {
      const content = [...state.streamingContent];
      const last = content[content.length - 1];
      if (last && last.type === "thought") {
        content[content.length - 1] = {
          type: "thought",
          text: last.text + event.text,
        };
      } else {
        content.push({ type: "thought", text: event.text });
      }
      return { ...state, streamingContent: content };
    }

    case "ToolCallStarted": {
      // ExitPlanMode tool call (kind: "switch_mode") in plan mode —
      // don't add to streamingContent (it's not a visible tool call).
      if (fullState.currentMode === "plan" && event.kind === "switch_mode") {
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
        messages: newMessages,
        streamingContent: [],
        isProcessing: false,
      };
    }

    case "Error":
      return { ...state, isProcessing: false };

    default:
      return state;
  }
}
