import { createSlice } from "../create-slice.ts";

/** UsageUpdated → updates token/cost usage info. */
export const usageUpdatedSlice = createSlice("UsageUpdated", (state, event) => {
  return {
    ...state,
    usage: {
      size: event.size,
      used: event.used,
      costAmount: event.costAmount,
      costCurrency: event.costCurrency,
    },
  };
});
