import type { ContentBlock } from "../types.ts";
import { createSlice } from "./create-slice.ts";

/** PromptSubmitted → adds user message, sets processing, clears error.
 *  Flushes any pending streaming content into a finalized assistant message first,
 *  so that replay (which lacks TurnCompleted between turns) preserves message order. */
export const promptSubmittedSlice = createSlice("PromptSubmitted", (state, event) => {
  const userContent: ContentBlock[] = [];
  if (event.images?.length) {
    for (const img of event.images) {
      userContent.push({ type: "image", data: img.data, mimeType: img.mimeType });
    }
  }
  if (event.text) {
    userContent.push({ type: "text", text: event.text });
  }

  // Flush pending streaming content into a finalized assistant message (turn boundary).
  // This handles replay where TurnCompleted is not sent between turns.
  let messages = state.messages;
  let streamingContent = state.streamingContent;
  if (streamingContent.length > 0) {
    messages = [...messages, { role: "assistant" as const, content: streamingContent }];
    streamingContent = [];
  }

  // Merge with preceding user message if no assistant response intervened (replay image+text chunks)
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "user" && state.isProcessing) {
    const merged = [...messages];
    merged[merged.length - 1] = { ...lastMsg, content: [...lastMsg.content, ...userContent] };
    return {
      ...state,
      messages: merged,
      streamingContent,
      isProcessing: true,
      error: null,
    };
  }

  return {
    ...state,
    messages: [
      ...messages,
      { role: "user", content: userContent },
    ],
    streamingContent,
    isProcessing: true,
    error: null,
  };
});
