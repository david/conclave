import type { Processor, DispatchFn } from "../slice-types.ts";
import type { DomainEvent } from "../../types.ts";
import { pipelineContexts } from "../create-session/processor.ts";

/** SubmitPromptForNextBlock: on SessionAddedToMetaContext, submit the prompt. */
export const submitPromptForNextBlock: Processor = {
  watches: "SessionAddedToMetaContext",
  handler: async (event: DomainEvent, dispatch: DispatchFn) => {
    if (event.type !== "SessionAddedToMetaContext" || !("sessionId" in event)) return;
    const ctx = pipelineContexts.get(event.sessionId);
    if (ctx) {
      pipelineContexts.delete(event.sessionId);
      await dispatch(event.sessionId, {
        type: "SubmitPrompt",
        text: event.commandText,
      });
    }
  },
};
