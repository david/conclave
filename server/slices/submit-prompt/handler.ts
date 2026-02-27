import type { SubmitPromptCmd } from "../../types.ts";
import type { SessionRegistryState } from "../../server-state.ts";
import type { EmitFn, BridgeLike } from "../slice-types.ts";

export async function handleSubmitPrompt(
  sessionId: string,
  command: SubmitPromptCmd,
  emit: EmitFn,
  registry: { getState(): SessionRegistryState },
  bridge: BridgeLike,
) {
  const meta = registry.getState().sessions.get(sessionId);
  if (!meta || !meta.loaded) {
    await emit(sessionId, {
      type: "ErrorOccurred",
      message: meta ? "Session not loaded" : `Session not found: ${sessionId}`,
    });
    return;
  }
  await emit(sessionId, {
    type: "PromptSubmitted",
    text: command.text,
    images: command.images,
  });
  bridge.submitPrompt(sessionId, command.text, command.images, true);
}
