import type { RecordErrorCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordError(sessionId: string, command: RecordErrorCmd, emit: EmitFn) {
  await emit(sessionId, { type: "ErrorOccurred", message: command.message });
}
