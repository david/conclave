import type { LoadSessionCmd } from "../../types.ts";
import type { SessionRegistryState } from "../../server-state.ts";
import type { EmitFn, BridgeLike } from "../slice-types.ts";

export async function handleLoadSession(
  sessionId: string,
  _command: LoadSessionCmd,
  emit: EmitFn,
  registry: { getState(): SessionRegistryState },
  bridge: BridgeLike,
) {
  const meta = registry.getState().sessions.get(sessionId);
  if (!meta) {
    await emit(sessionId, { type: "ErrorOccurred", message: `Session not found: ${sessionId}` });
    return;
  }
  if (meta.loaded) return; // Already loaded, no-op
  await bridge.loadSession(sessionId);
  await emit(sessionId, { type: "SessionLoaded" });
}
