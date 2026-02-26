# Workspace Always Visible — Test Plan

The change modifies the `workspaceVisible` computation in `client/index.tsx`. This logic is currently inline in the `App` component and untestable in isolation. The implementation should extract it into a pure function so it can be unit tested. One new unit test file covers the desktop-always-visible behavior and the preserved mobile content gate.

## Existing Coverage

| Test file | Level | What it covers | Status |
|-----------|-------|---------------|--------|
| `client/components/workspace.test.ts` | unit | `groupGitFiles`, `GitFileRow`, `filesSummary` pure functions | sufficient |
| `client/reducer.test.ts` | unit | State reducer logic for all event types | sufficient |

No existing tests cover the `workspaceVisible` computation.

## Desktop Workspace Visibility

### isWorkspaceVisible — desktop, no content — returns true

- **Level:** unit
- **Status:** new
- **File:** `client/workspace-visible.test.ts`
- **Covers:** Step 1 (desktop always true) and step 2 (no sessionId guard on desktop)
- **Scenario:**
  - **Arrange:** `isMobile = false`, empty state (no sessionId, no planEntries, no gitFiles, no specs, no services)
  - **Act:** Call `isWorkspaceVisible(false, state)`
  - **Assert:** Returns `true`

### isWorkspaceVisible — desktop, with content — returns true

- **Level:** unit
- **Status:** new
- **File:** `client/workspace-visible.test.ts`
- **Covers:** Step 1 (desktop always true regardless of content)
- **Scenario:**
  - **Arrange:** `isMobile = false`, state with `sessionId = "s1"` and `planEntries.length > 0`
  - **Act:** Call `isWorkspaceVisible(false, state)`
  - **Assert:** Returns `true`

### isWorkspaceVisible — mobile, no content — returns false

- **Level:** unit
- **Status:** new
- **File:** `client/workspace-visible.test.ts`
- **Covers:** Step 1 (mobile preserves content gate)
- **Scenario:**
  - **Arrange:** `isMobile = true`, state with `sessionId = "s1"` but all content arrays empty
  - **Act:** Call `isWorkspaceVisible(true, state)`
  - **Assert:** Returns `false`

### isWorkspaceVisible — mobile, with content — returns true

- **Level:** unit
- **Status:** new
- **File:** `client/workspace-visible.test.ts`
- **Covers:** Step 1 (mobile shows workspace when content exists)
- **Scenario:**
  - **Arrange:** `isMobile = true`, state with `sessionId = "s1"` and `gitFiles.length > 0`
  - **Act:** Call `isWorkspaceVisible(true, state)`
  - **Assert:** Returns `true`

### isWorkspaceVisible — mobile, no session — returns false

- **Level:** unit
- **Status:** new
- **File:** `client/workspace-visible.test.ts`
- **Covers:** Step 1 (mobile still requires session for content gate to matter)
- **Scenario:**
  - **Arrange:** `isMobile = true`, state with no `sessionId` and `planEntries.length > 0`
  - **Act:** Call `isWorkspaceVisible(true, state)`
  - **Assert:** Returns `false`
