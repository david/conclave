import type { AppState, ClientEvent } from "../types.ts";

/** AgentText → appends or extends text in streaming content. */
export function agentTextSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "AgentText") return state;

  const content = [...state.streamingContent];
  const last = content[content.length - 1];
  if (last && last.type === "text") {
    content[content.length - 1] = { type: "text", text: last.text + event.text };
  } else {
    content.push({ type: "text", text: event.text });
  }
  return { ...state, streamingContent: content };
}
