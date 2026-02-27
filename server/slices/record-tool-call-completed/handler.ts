import type { RecordToolCallCompletedCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordToolCallCompleted(sessionId: string, command: RecordToolCallCompletedCmd, emit: EmitFn) {
  await emit(sessionId, {
    type: "ToolCallCompleted",
    toolCallId: command.toolCallId,
    status: command.status,
    output: command.output,
  });
}
