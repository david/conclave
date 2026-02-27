import type { CancelPromptCmd } from "../../types.ts";
import type { EmitFn, BridgeLike } from "../slice-types.ts";

export async function handleCancelPrompt(sessionId: string, _command: CancelPromptCmd, emit: EmitFn, bridge: BridgeLike) {
  await emit(sessionId, { type: "CancellationRequested" });
  bridge.cancel(sessionId);
}
