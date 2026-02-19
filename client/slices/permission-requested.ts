import { createSlice } from "./create-slice.ts";

/** PermissionRequested → sets pending permission and optionally updates plan content. */
export const permissionRequestedSlice = createSlice("PermissionRequested", (state, event) => {
  return {
    ...state,
    pendingPermission: {
      options: event.options,
      toolName: event.toolName,
    },
    planContent: event.planContent || state.planContent,
  };
});
