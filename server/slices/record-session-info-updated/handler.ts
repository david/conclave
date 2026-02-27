import type { RecordSessionInfoUpdatedCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordSessionInfoUpdated(sessionId: string, command: RecordSessionInfoUpdatedCmd, emit: EmitFn) {
  await emit(sessionId, {
    type: "SessionInfoUpdated",
    title: command.title,
    updatedAt: command.updatedAt,
  });
}
