import type { ContentBlock } from "../types.ts";
import { createSlice } from "./create-slice.ts";

/** PromptSubmitted → adds user message, sets processing, clears error and pending permission. */
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

  // Merge with preceding user message if it exists and has no text yet (replay image+text chunks)
  const prevMessages = [...state.messages];
  const lastMsg = prevMessages[prevMessages.length - 1];
  if (lastMsg && lastMsg.role === "user" && state.isProcessing) {
    lastMsg.content = [...lastMsg.content, ...userContent];
    return {
      ...state,
      messages: prevMessages,
      isProcessing: true,
      error: null,
      pendingPermission: null,
    };
  }

  return {
    ...state,
    messages: [
      ...state.messages,
      { role: "user", content: userContent },
    ],
    isProcessing: true,
    error: null,
    pendingPermission: null,
  };
});
