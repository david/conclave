import type { NextBlockClickCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleNextBlockClick(sessionId: string, command: NextBlockClickCmd, emit: EmitFn) {
  await emit(sessionId, {
    type: "NextBlockInitiated",
    currentSessionId: command.currentSessionId,
    label: command.label,
    commandText: command.commandText,
    metaContext: command.metaContext,
  });
}
