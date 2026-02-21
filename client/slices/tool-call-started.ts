import type { ToolCallInfo } from "../types.ts";
import { createSlice } from "./create-slice.ts";

/** ToolCallStarted → adds tool call to streaming content. */
export const toolCallStartedSlice = createSlice("ToolCallStarted", (state, event) => {
  let { streamingContent } = state;

  // Deduplicate: ACP agent sends tool_call twice (stream + message completion)
  const alreadyExists = streamingContent.some(
    (block) =>
      block.type === "tool_call" &&
      block.toolCall.toolCallId === event.toolCallId,
  );

  if (!alreadyExists) {
    const toolCall: ToolCallInfo = {
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      kind: event.kind,
      input: event.input,
      status: "pending",
    };
    streamingContent = [...streamingContent, { type: "tool_call" as const, toolCall }];
  }

  return { ...state, streamingContent };
});
