import { createSlice } from "../create-slice.ts";
import { patchToolCallInStream } from "../utils.ts";

/** ToolCallUpdated → updates tool call status and content in streaming content. */
export const toolCallUpdatedSlice = createSlice("ToolCallUpdated", (state, event) => {
  const streamingContent = patchToolCallInStream(state.streamingContent, event.toolCallId, {
    status: event.status,
    ...(event.content != null && { content: event.content }),
  });
  return { ...state, streamingContent };
});
