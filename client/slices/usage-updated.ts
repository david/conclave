import type { AppState, ClientEvent } from "../types.ts";

/** UsageUpdated → updates token/cost usage info. */
export function usageUpdatedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "UsageUpdated") return state;
  return {
    ...state,
    usage: {
      size: event.size,
      used: event.used,
      costAmount: event.costAmount,
      costCurrency: event.costCurrency,
    },
  };
}
