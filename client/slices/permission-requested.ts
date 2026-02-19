import type { AppState, ClientEvent } from "../types.ts";

/** PermissionRequested → sets pending permission and optionally updates plan content. */
export function permissionRequestedSlice(state: AppState, event: ClientEvent): AppState {
  if (event.type !== "PermissionRequested") return state;
  return {
    ...state,
    pendingPermission: {
      options: event.options,
      toolName: event.toolName,
    },
    planContent: event.planContent || state.planContent,
  };
}
