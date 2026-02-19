import type { ClientEvent, PlanEntryInfo } from "../types.ts";

export type PlanState = {
  currentMode: string;
  planContent: string;
  planEntries: PlanEntryInfo[];
};

export const initialPlanState: PlanState = {
  currentMode: "",
  planContent: "",
  planEntries: [],
};

export function planReducer(state: PlanState, event: ClientEvent): PlanState {
  switch (event.type) {
    case "ModeChanged": {
      if (event.modeId === "plan") {
        return { ...state, currentMode: "plan", planContent: "" };
      }
      return { ...state, currentMode: event.modeId };
    }

    case "PlanUpdated":
      return { ...state, planEntries: event.entries };

    case "PermissionRequested":
      return {
        ...state,
        planContent: event.planContent || state.planContent,
      };

    default:
      return state;
  }
}
