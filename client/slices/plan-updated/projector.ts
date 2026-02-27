import { createSlice } from "../create-slice.ts";

/** PlanUpdated → replaces plan entries list. */
export const planUpdatedSlice = createSlice("PlanUpdated", (state, event) => {
  return { ...state, planEntries: event.entries };
});
