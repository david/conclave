import type { Processor, DispatchFn } from "../slice-types.ts";
import type { DomainEvent } from "../../types.ts";
import type { SessionRegistryState } from "../../server-state.ts";

/** LoadIfUnloaded: on SessionSwitched, load if not yet loaded. */
export function createLoadIfUnloaded(registry: { getState(): SessionRegistryState }): Processor {
  return {
    watches: "SessionSwitched",
    handler: async (event: DomainEvent, dispatch: DispatchFn) => {
      if (event.type !== "SessionSwitched" || !("sessionId" in event)) return;
      const meta = registry.getState().sessions.get(event.sessionId);
      if (meta && !meta.loaded) {
        await dispatch(event.sessionId, { type: "LoadSession" });
      }
    },
  };
}
