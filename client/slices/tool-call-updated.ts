import type { AppState, ClientEvent } from "../types.ts";

/** ToolCallUpdated → updates tool call status and content in streaming content. */
export function toolCallUpdatedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "ToolCallUpdated") return state;

  const streamingContent = state.streamingContent.map((block) => {
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
  return { ...state, streamingContent };
}
