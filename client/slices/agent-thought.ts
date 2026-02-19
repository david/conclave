import { createSlice } from "./create-slice.ts";
import { appendStreamingText } from "./utils.ts";

/** AgentThought → appends or extends thought in streaming content. */
export const agentThoughtSlice = createSlice("AgentThought", (state, event) => {
  return { ...state, streamingContent: appendStreamingText(state.streamingContent, "thought", event.text) };
});
