import type { Processor, DispatchFn } from "../slice-types.ts";
import type { DomainEvent } from "../../types.ts";

/** EnsureMetaContext: on NextBlockInitiated, issue EnsureMetaContext command. */
export const ensureMetaContext: Processor = {
  watches: "NextBlockInitiated",
  handler: async (event: DomainEvent, dispatch: DispatchFn) => {
    if (event.type !== "NextBlockInitiated" || !("sessionId" in event)) return;
    await dispatch(event.sessionId, {
      type: "EnsureMetaContext",
      originSessionId: event.currentSessionId,
      metaContextName: event.metaContext,
      commandText: event.commandText,
    });
  },
};
