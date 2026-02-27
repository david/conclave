import type { AddSessionToMetaContextCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleAddSessionToMetaContext(_sessionId: string, command: AddSessionToMetaContextCmd, emit: EmitFn) {
  await emit(command.sessionId, {
    type: "SessionAddedToMetaContext",
    metaContextId: command.metaContextId,
    commandText: command.commandText,
  });
}
