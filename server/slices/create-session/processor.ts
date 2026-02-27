import type { Processor, DispatchFn } from "../slice-types.ts";
import type { DomainEvent } from "../../types.ts";

/**
 * Pipeline context for tracking next-block-click processor chains.
 * Exported so other processors in the pipeline can access it.
 */
export const pipelineContexts = new Map<string, {
  metaContextId: string;
  commandText: string;
  originSessionId: string;
}>();

/** AutoSwitchAfterCreate: on SessionCreated, issue SwitchSession. */
export const autoSwitchAfterCreate: Processor = {
  watches: "SessionCreated",
  handler: async (event: DomainEvent, dispatch: DispatchFn) => {
    if (!("sessionId" in event)) return;
    await dispatch(event.sessionId, { type: "SwitchSession" });
  },
};

/** AssociateWithMetaContext: on SessionCreated, check if pipeline context exists and associate. */
export const associateWithMetaContext: Processor = {
  watches: "SessionCreated",
  handler: async (event: DomainEvent, dispatch: DispatchFn) => {
    if (!("sessionId" in event)) return;
    for (const [key, ctx] of pipelineContexts) {
      if (key.startsWith("pending:")) {
        pipelineContexts.delete(key);
        pipelineContexts.set(event.sessionId, ctx);
        await dispatch(event.sessionId, {
          type: "AddSessionToMetaContext",
          sessionId: event.sessionId,
          metaContextId: ctx.metaContextId,
          commandText: ctx.commandText,
        });
        return;
      }
    }
  },
};
