import type { ClientEvent, UsageInfo } from "../types.ts";

export type UsageState = {
  usage: UsageInfo | null;
};

export const initialUsageState: UsageState = {
  usage: null,
};

export function usageReducer(state: UsageState, event: ClientEvent): UsageState {
  switch (event.type) {
    case "UsageUpdated":
      return {
        usage: {
          size: event.size,
          used: event.used,
          costAmount: event.costAmount,
          costCurrency: event.costCurrency,
        },
      };

    default:
      return state;
  }
}
