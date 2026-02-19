import type { AppState, ClientEvent, ToolCallInfo } from "../types.ts";
import { extractFilePath, kindToAction } from "./utils.ts";

/** ToolCallStarted → adds tool call to streaming content, tracks file changes. */
export function toolCallStartedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "ToolCallStarted") return state;

  let { streamingContent, fileChanges } = state;

  // --- streaming content ---

  // ExitPlanMode tool call (kind: "switch_mode") in plan mode —
  // don't add to streamingContent (it's not a visible tool call).
  const suppressToolCall = state.currentMode === "plan" && event.kind === "switch_mode";

  if (!suppressToolCall) {
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
}
