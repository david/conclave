import type { CompleteTurnCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleCompleteTurn(sessionId: string, command: CompleteTurnCmd, emit: EmitFn) {
  await emit(sessionId, { type: "TurnCompleted", stopReason: command.stopReason });
}
