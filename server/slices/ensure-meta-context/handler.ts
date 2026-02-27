import type { EnsureMetaContextCmd } from "../../types.ts";
import type { MetaContextRegistryState } from "../../server-state.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleEnsureMetaContext(
  sessionId: string,
  command: EnsureMetaContextCmd,
  emit: EmitFn,
  metaContextRegistry: { getState(): MetaContextRegistryState },
) {
  const mcState = metaContextRegistry.getState();
  const existingId = mcState.nameIndex.get(command.metaContextName);
  if (existingId) {
    await emit(sessionId, {
      type: "MetaContextEnsured",
      metaContextId: existingId,
      metaContextName: command.metaContextName,
      originSessionId: command.originSessionId,
      commandText: command.commandText,
      created: false,
    });
  } else {
    const newId = crypto.randomUUID();
    await emit(sessionId, {
      type: "MetaContextEnsured",
      metaContextId: newId,
      metaContextName: command.metaContextName,
      originSessionId: command.originSessionId,
      commandText: command.commandText,
      created: true,
    });
  }
}
