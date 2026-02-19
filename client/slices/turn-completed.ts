import type { AppState, ClientEvent } from "../types.ts";

/** TurnCompleted → flushes streaming content into a finalized assistant message. */
export function turnCompletedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "TurnCompleted") return state;

  const hasContent = state.streamingContent.length > 0;
  const messages = hasContent
    ? [...state.messages, { role: "assistant" as const, content: state.streamingContent }]
    : state.messages;

  return { ...state, messages, streamingContent: [], isProcessing: false };
}
