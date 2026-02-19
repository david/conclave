import type { AppState, ClientEvent } from "../types.ts";

/** AgentThought → appends or extends thought in streaming content. */
export function agentThoughtSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "AgentThought") return state;

  const content = [...state.streamingContent];
  const last = content[content.length - 1];
  if (last && last.type === "thought") {
    content[content.length - 1] = { type: "thought", text: last.text + event.text };
  } else {
    content.push({ type: "thought", text: event.text });
  }
  return { ...state, streamingContent: content };
}
