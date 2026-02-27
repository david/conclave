import type { RecordPlanUpdatedCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordPlanUpdated(sessionId: string, command: RecordPlanUpdatedCmd, emit: EmitFn) {
  await emit(sessionId, { type: "PlanUpdated", entries: command.entries });
}
