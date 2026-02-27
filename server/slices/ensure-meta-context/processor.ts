import type { Processor, DispatchFn } from "../slice-types.ts";
import type { DomainEvent } from "../../types.ts";
import { pipelineContexts } from "../create-session/processor.ts";

/** CreateSessionForMetaContext: on MetaContextEnsured, create a new session. */
export const createSessionForMetaContext: Processor = {
  watches: "MetaContextEnsured",
  handler: async (event: DomainEvent, dispatch: DispatchFn) => {
    if (event.type !== "MetaContextEnsured" || !("sessionId" in event)) return;
    const pipelineKey = `pending:${event.metaContextId}:${event.originSessionId}`;
    pipelineContexts.set(pipelineKey, {
      metaContextId: event.metaContextId,
      commandText: event.commandText,
      originSessionId: event.originSessionId,
    });
    await dispatch("_", { type: "CreateSession" });
  },
};
