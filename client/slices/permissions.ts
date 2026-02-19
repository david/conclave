import type { ClientEvent, PendingPermission } from "../types.ts";

export type PermissionsState = {
  pendingPermission: PendingPermission | null;
};

export const initialPermissionsState: PermissionsState = {
  pendingPermission: null,
};

export function permissionsReducer(state: PermissionsState, event: ClientEvent): PermissionsState {
  switch (event.type) {
    case "PromptSubmitted":
      return { pendingPermission: null };

    case "ModeChanged":
      return { pendingPermission: null };

    case "PermissionRequested":
      return {
        pendingPermission: {
          options: event.options,
          toolName: event.toolName,
        },
      };

    default:
      return state;
  }
}
