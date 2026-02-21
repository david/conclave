# Git Status Files — Tasks

New Types are merged into their consuming tasks (T-0 absorbs server types, T-1 absorbs client types) so the two main tracks — server polling and client state — run in parallel in wave 0. UI refinements (icons, line counts) follow sequentially since they share `workspace.tsx`.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Server git poller and types",
    "ucs": ["UC-1", "UC-5"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": ["server/git-status-poller.ts", "server/git-status-poller.test.ts"],
      "modify": ["server/types.ts", "server/index.ts"]
    },
    "description": "Add server-side GitStatusUpdated event type, create the git-status-poller module with parsing/merging logic, wire it into the server with interval polling, broadcast, and replay-on-connect."
  },
  {
    "id": "T-1",
    "name": "Client state and grouped file display",
    "ucs": ["UC-2", "UC-6"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": ["client/slices/git-status-updated.ts"],
      "modify": ["client/types.ts", "client/slices/index.ts", "client/slices/tool-call-started.ts", "client/slices/tool-call-completed.ts", "client/slices/session-switched.ts", "client/reducer.ts", "client/components/workspace.tsx", "client/index.tsx"]
    },
    "description": "Replace fileChanges with gitFiles in client state. Add GitStatusUpdated slice, remove tool-call file tracking, update workspace to group files into Staged/Unstaged/Untracked sections. UC-6 is handled by existing conditional rendering — verify only."
  },
  {
    "id": "T-2",
    "name": "Git status icons",
    "ucs": ["UC-3"],
    "depends": ["T-1"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/icons.tsx", "client/components/workspace.tsx"]
    },
    "description": "Add GitStatusIcon SVG component with distinct icons and colors for M/A/D/R/? statuses. Wire into GitFileRow in workspace."
  },
  {
    "id": "T-3",
    "name": "Line-level change counts",
    "ucs": ["UC-4"],
    "depends": ["T-2"],
    "wave": 2,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/workspace.tsx", "client/style.css"]
    },
    "description": "Add +N/-N line count badges per file row and totals in the collapsed Files section header. Add CSS styles for additions/deletions display."
  }
]
```

## Wave 0 (parallel)

### T-0: Server git poller and types
- **UCs**: UC-1, UC-5
- **Files**: create `server/git-status-poller.ts`, create `server/git-status-poller.test.ts`, modify `server/types.ts`, modify `server/index.ts`
- **Summary**: Add the server-side `GitStatusUpdated` event and the polling infrastructure.
- **Steps**:
  1. Add `GitFileStatus`, `GitFileEntry`, and `GitStatusUpdated` to `server/types.ts`. Add `GitStatusUpdated` to the `GlobalEvent` union (flows into `GlobalEventPayload` via `DistributiveOmit`).
  2. Create `server/git-status-poller.ts` exporting:
     - `parseGitStatus(raw: string)` — parses `git status --porcelain=v1` output. Each line is `XY path`. Handle `??` (untracked), `!!` (ignored — filter out), and `R` with `->` rename arrows (use destination path).
     - `parseNumstat(raw: string)` — parses `git diff --numstat` output. Each line is `added\tdeleted\tpath`. Binary files (`-\t-\tpath`) → 0/0.
     - `mergeGitData(statusEntries, stagedNumstat, unstagedNumstat): GitFileEntry[]` — joins status and numstat data. Index status entries take counts from staged numstat, work-tree entries from unstaged numstat. Untracked files get 0/0.
     - `startGitStatusPoller(options): { stop: () => void }` — `setInterval` that runs `git status --porcelain=v1`, `git diff --numstat`, `git diff --cached --numstat` via `Bun.spawn` (all three in parallel). Parses, merges, deep-compares against previous result (JSON stringify). If changed, calls `onUpdate`. If git fails (non-zero exit or "not a git repository" stderr), log warning and skip (UC-5).
  3. In `server/index.ts`:
     - Import `startGitStatusPoller`.
     - After server startup (in `bridge.start().then(...)`), call `startGitStatusPoller({ cwd: CWD, intervalMs: 3000, onUpdate })` where `onUpdate` calls `store.appendGlobal({ type: "GitStatusUpdated", files })`.
     - Track `latestGitStatusEvent` same as `latestSpecListEvent` — subscribe to store, save on `GitStatusUpdated`, broadcast to all connected clients.
     - In `websocket.open`, replay `latestGitStatusEvent` to new connections.
- **Tests**:
  - `parseGitStatus` correctly parses modified, added, deleted, renamed, and untracked entries
  - `parseGitStatus` handles empty output (clean working tree)
  - `parseNumstat` parses normal entries and binary file entries (dash/dash)
  - `mergeGitData` joins status and numstat data, assigns 0/0 to untracked files
  - `mergeGitData` sums staged + unstaged line counts for files appearing in both

### T-1: Client state and grouped file display
- **UCs**: UC-2, UC-6
- **Files**: create `client/slices/git-status-updated.ts`, modify `client/types.ts`, modify `client/slices/index.ts`, modify `client/slices/tool-call-started.ts`, modify `client/slices/tool-call-completed.ts`, modify `client/slices/session-switched.ts`, modify `client/reducer.ts`, modify `client/components/workspace.tsx`, modify `client/index.tsx`
- **Summary**: Replace the tool-call-derived `fileChanges` model with `gitFiles`. Add the client slice, remove old file tracking, and update workspace to show grouped git status sections.
- **Steps**:
  1. In `client/types.ts`: add `GitFileEntry` type (path, indexStatus, workTreeStatus, linesAdded, linesDeleted). Replace `fileChanges: FileChangeInfo[]` with `gitFiles: GitFileEntry[]` in `AppState` and `initialState`. Remove `FileChangeAction` and `FileChangeInfo` types.
  2. Create `client/slices/git-status-updated.ts` using `createSlice("GitStatusUpdated", ...)` — sets `state.gitFiles` to `event.files`.
  3. In `client/slices/index.ts`: import and register `gitStatusUpdatedSlice`.
  4. In `client/slices/tool-call-started.ts`: remove the entire `fileChanges` tracking section (the `extractFilePath`, `kindToAction` imports and the file-tracking block). Keep only streaming content logic.
  5. In `client/slices/tool-call-completed.ts`: remove the `fileChanges` patching block. Keep only streaming content logic.
  6. In `client/slices/session-switched.ts`: preserve `gitFiles` across session switches (like `specs`): `return { ...initialState, sessions: state.sessions, specs: state.specs, gitFiles: state.gitFiles, sessionId: event.sessionId }`.
  7. In `client/reducer.ts`: update re-exports — remove `FileChangeAction`, `FileChangeInfo`; add `GitFileEntry`.
  8. In `client/components/workspace.tsx`:
     - Replace `fileChanges` prop with `gitFiles: GitFileEntry[]`.
     - Add `groupGitFiles(files)` helper partitioning into: `staged` (indexStatus not `" "` or `"?"`), `unstaged` (workTreeStatus not `" "` and not `"?"`), `untracked` (both statuses `"?"`). A file can appear in both staged and unstaged.
     - Replace Files section: when expanded, render Staged/Unstaged/Untracked sub-sections each with header (name + count). Hide empty sub-sections.
     - Collapsed summary: total file count (deduplicated) with count label.
     - Remove old `FileChangeRow` component and `filesSummary` function.
  9. In `client/index.tsx`: replace `state.fileChanges` with `state.gitFiles` in `workspaceVisible` condition and `Workspace` props.
  10. UC-6 is handled by existing conditional rendering — when `gitFiles` is empty, Files section is hidden; when all sections are empty, workspace shows empty state.
- **Tests**:
  - `gitStatusUpdatedSlice` stores `event.files` into `state.gitFiles`
  - `sessionSwitchedSlice` preserves `gitFiles` across switches
  - `groupGitFiles` correctly partitions files into staged, unstaged, untracked
  - `groupGitFiles` puts a file with both index and work-tree changes into both staged and unstaged
  - When `gitFiles` is empty, Files section is not rendered

## Wave 1 (after wave 0)

### T-2: Git status icons
- **UCs**: UC-3
- **Depends on**: T-1
- **Files**: modify `client/components/icons.tsx`, modify `client/components/workspace.tsx`
- **Summary**: Add per-file status icons with distinct shapes and colors for each git status.
- **Steps**:
  1. In `client/components/icons.tsx`, add `GitStatusIcon` component:
     - Props: `status: string` (single-char git status), `size?: number`.
     - SVG icons consistent with existing icon style:
       - `"M"` (modified): pencil/edit icon, color `var(--color-warning)`
       - `"A"` (added): plus icon, color `var(--color-success)`
       - `"D"` (deleted): minus icon, color `var(--color-error)`
       - `"R"` (renamed): right-arrow icon, color `var(--color-info)`
       - `"?"` (untracked): question mark icon, color `var(--color-muted)`
       - Default: empty circle for unknown statuses
  2. In `client/components/workspace.tsx`, update `GitFileRow` to use `GitStatusIcon`. Pass the relevant status character: `indexStatus` for staged section, `workTreeStatus` for unstaged/untracked section (via a prop).
- **Tests**:
  - `GitStatusIcon` renders without crashing for each status character (M, A, D, R, ?)

## Wave 2 (after wave 1)

### T-3: Line-level change counts
- **UCs**: UC-4
- **Depends on**: T-2
- **Files**: modify `client/components/workspace.tsx`, modify `client/style.css`
- **Summary**: Add per-file and total line change counts (+N/-N) with color-coded display.
- **Steps**:
  1. In `GitFileRow` (workspace.tsx): after file name, render `+N` in green and `-N` in red. If both `linesAdded` and `linesDeleted` are 0 (untracked), show nothing.
  2. In Files section header (collapsed summary): compute `totalAdded`/`totalDeleted` across all files, display as `+N / -N` alongside file count.
  3. In `client/style.css`: add `.git-file__additions` (green text) and `.git-file__deletions` (red text) styles. Ensure `.workspace__section-summary` styles accommodate the line count display.
- **Tests**:
  - Files with non-zero line counts render `+N` and `-N` indicators
  - Files with 0/0 line counts render no indicators
