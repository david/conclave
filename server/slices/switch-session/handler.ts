import type { SwitchSessionCmd } from "../../types.ts";
import type { SessionRegistryState } from "../../server-state.ts";
import type { EmitFn } from "../slice-types.ts";

// Unique identifier for this server process lifetime.
const SERVER_EPOCH = crypto.randomUUID();

/** Returns the server epoch for use by the WS layer. */
export function getServerEpoch(): string {
  return SERVER_EPOCH;
}

export async function handleSwitchSession(
  sessionId: string,
  _command: SwitchSessionCmd,
  emit: EmitFn,
  registry: { getState(): SessionRegistryState },
) {
  const meta = registry.getState().sessions.get(sessionId);
  if (!meta) {
    await emit(sessionId, { type: "ErrorOccurred", message: `Session not found: ${sessionId}` });
    return;
  }
  await emit(sessionId, { type: "SessionSwitched", epoch: SERVER_EPOCH });
}
