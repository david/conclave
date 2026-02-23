import { createSlice } from "./create-slice.ts";

/** TurnCompleted → flushes streaming content into a finalized assistant message. */
export const turnCompletedSlice = createSlice("TurnCompleted", (state) => {
  const hasContent = state.streamingContent.length > 0;
  const content = hasContent
    ? state.streamingContent
    : [{ type: "text" as const, text: "(No response from agent)" }];
  const messages = [...state.messages, { role: "assistant" as const, content }];

  return { ...state, messages, streamingContent: [], isProcessing: false };
});
