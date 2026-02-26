# Workspace Always Visible — Implementation

Remove the content gate from the desktop workspace layout so the sidebar is always visible, regardless of whether plan entries, git files, specs, or services exist. Mobile behavior is unchanged.

## Desktop Workspace Visibility

**Files:**
- `client/index.tsx` — modify the `workspaceVisible` computation

**Steps:**
1. Change the `workspaceVisible` computation (currently around line 155) to use `!isMobile` as the desktop condition instead of the content-length checks. The new logic:
   - **Desktop (`!isMobile`)**: always `true` — the workspace is unconditionally visible
   - **Mobile (`isMobile`)**: keep the existing content gate (`state.planEntries.length > 0 || state.gitFiles.length > 0 || state.specs.length > 0 || state.services.length > 0`) so the workspace tab only appears when there's content to show
2. Remove the `!!state.sessionId` guard from the desktop path — the workspace should show even before a session is active.
3. The `layoutClasses` computation and the conditional rendering of `<Workspace>` already reference `isMobile` and `workspaceVisible` correctly — no changes needed there.
