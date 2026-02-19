import type { AppState, ClientEvent } from "../types.ts";

/** ToolCallCompleted → finalizes tool call in streaming content, updates file change status. */
export function toolCallCompletedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "ToolCallCompleted") return state;

  // --- streaming content ---

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
          output: event.output,
        },
      };
    }
    return block;
  });

  // --- file changes ---

  let { fileChanges } = state;
  const idx = fileChanges.findIndex((f) => f.toolCallId === event.toolCallId);
  if (idx !== -1) {
    fileChanges = [...fileChanges];
    fileChanges[idx] = { ...fileChanges[idx], status: event.status };
  }

  return { ...state, streamingContent, fileChanges };
}
