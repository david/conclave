import { createSlice } from "./create-slice.ts";
import { patchToolCallInStream } from "./utils.ts";

/** ToolCallCompleted → finalizes tool call in streaming content. */
export const toolCallCompletedSlice = createSlice("ToolCallCompleted", (state, event) => {
  const streamingContent = patchToolCallInStream(state.streamingContent, event.toolCallId, {
    status: event.status,
    output: event.output,
  });

  return { ...state, streamingContent };
});
