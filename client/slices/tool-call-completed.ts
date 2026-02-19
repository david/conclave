import { createSlice } from "./create-slice.ts";
import { patchToolCallInStream } from "./utils.ts";

/** ToolCallCompleted → finalizes tool call in streaming content, updates file change status. */
export const toolCallCompletedSlice = createSlice("ToolCallCompleted", (state, event) => {
  const streamingContent = patchToolCallInStream(state.streamingContent, event.toolCallId, {
    status: event.status,
    output: event.output,
  });

  let { fileChanges } = state;
  const idx = fileChanges.findIndex((f) => f.toolCallId === event.toolCallId);
  if (idx !== -1) {
    fileChanges = [...fileChanges];
    fileChanges[idx] = { ...fileChanges[idx], status: event.status };
  }

  return { ...state, streamingContent, fileChanges };
});
