import { createSlice } from "./create-slice.ts";
import { appendStreamingText } from "./utils.ts";

/** AgentText → appends or extends text in streaming content. */
export const agentTextSlice = createSlice("AgentText", (state, event) => {
  return { ...state, streamingContent: appendStreamingText(state.streamingContent, "text", event.text) };
});
