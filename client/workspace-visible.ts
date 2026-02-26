import type { AppState } from "./types.ts";

export function isWorkspaceVisible(
  isMobile: boolean,
  state: Pick<AppState, "sessionId" | "planEntries" | "gitFiles" | "specs" | "services">,
): boolean {
  return !!state.sessionId && (
    state.planEntries.length > 0 ||
    state.gitFiles.length > 0 ||
    state.specs.length > 0 ||
    state.services.length > 0
  );
}
