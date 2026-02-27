import type { RecordUsageUpdatedCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordUsageUpdated(sessionId: string, command: RecordUsageUpdatedCmd, emit: EmitFn) {
  await emit(sessionId, {
    type: "UsageUpdated",
    size: command.size,
    used: command.used,
    ...(command.costAmount !== undefined ? { costAmount: command.costAmount, costCurrency: command.costCurrency } : {}),
  });
}
