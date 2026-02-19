import { createSlice } from "./create-slice.ts";

/** TurnCompleted → flushes streaming content into a finalized assistant message. */
export const turnCompletedSlice = createSlice("TurnCompleted", (state) => {
  const hasContent = state.streamingContent.length > 0;
  const messages = hasContent
    ? [...state.messages, { role: "assistant" as const, content: state.streamingContent }]
    : state.messages;

  return { ...state, messages, streamingContent: [], isProcessing: false };
});
