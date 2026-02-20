import type { ToolCallInfo } from "../types.ts";
import { createSlice } from "./create-slice.ts";
import { extractFilePath, kindToAction } from "./utils.ts";

/** ToolCallStarted → adds tool call to streaming content, tracks file changes. */
export const toolCallStartedSlice = createSlice("ToolCallStarted", (state, event) => {
  let { streamingContent, fileChanges } = state;

  // --- streaming content ---

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

  // --- file changes ---

  const filePath = extractFilePath(event.input);
  const action = kindToAction(event.kind);
  if (filePath && action && !filePath.includes(".claude/plans/")) {
    const idx = fileChanges.findIndex((f) => f.filePath === filePath);
    if (idx !== -1) {
      fileChanges = [...fileChanges];
      fileChanges[idx] = {
        ...fileChanges[idx],
        action,
        toolCallId: event.toolCallId,
        status: "pending",
      };
    } else {
      fileChanges = [
        ...fileChanges,
        { filePath, action, toolCallId: event.toolCallId, status: "pending" },
      ];
    }
  }

  return { ...state, streamingContent, fileChanges };
});
