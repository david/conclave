import type { RecordToolCallStartedCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordToolCallStarted(sessionId: string, command: RecordToolCallStartedCmd, emit: EmitFn) {
  await emit(sessionId, {
    type: "ToolCallStarted",
    toolCallId: command.toolCallId,
    toolName: command.toolName,
    kind: command.kind,
    input: command.input,
  });
}
