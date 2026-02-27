import type { RecordToolCallUpdatedCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordToolCallUpdated(sessionId: string, command: RecordToolCallUpdatedCmd, emit: EmitFn) {
  await emit(sessionId, {
    type: "ToolCallUpdated",
    toolCallId: command.toolCallId,
    status: command.status,
    content: command.content,
  });
}
