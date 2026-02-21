# Git Status Files — Implementation

Replace the tool-call-derived Files panel with a server-polled `git status` + `git diff --numstat` pipeline. The server runs git commands on an interval, diffs against the previous result, and broadcasts a `GitStatusUpdated` global event over WebSocket. The client replaces the `fileChanges` state with a new `gitFiles` model, grouped by status category, with per-file line counts and status icons.

## New Types

### Server (`server/types.ts`)

```ts
export type GitFileStatus = "M" | "A" | "D" | "R" | "?" | "!";

export type GitFileEntry = {
  path: string;
  indexStatus: GitFileStatus;
  workTreeStatus: GitFileStatus;
  linesAdded: number;
  linesDeleted: number;
};

export type GitStatusUpdated = BaseGlobalEvent & {
  type: "GitStatusUpdated";
  files: GitFileEntry[];
};
```

Add `GitStatusUpdated` to the `GlobalEvent` union and `GlobalEventPayload` derivation (it already flows through `DistributiveOmit`). Add it to `WsEvent` so the client can receive it.

### Client (`client/types.ts`)

```ts
export type GitFileEntry = {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
  linesAdded: number;
  linesDeleted: number;
};
```

Replace `fileChanges: FileChangeInfo[]` with `gitFiles: GitFileEntry[]` in `AppState` and `initialState`. Remove the `FileChangeAction` and `FileChangeInfo` types (they become unused).

## UC-1 + UC-5: Poll git status with diff stats / Handle non-git directory

**Files:**
- `server/git-status-poller.ts` — new module; runs git commands on an interval and calls back on change
- `server/git-status-poller.test.ts` — tests for parsing and diffing logic
- `server/types.ts` — add `GitFileEntry`, `GitFileStatus`, `GitStatusUpdated` types
- `server/index.ts` — create poller, wire callback to `store.appendGlobal()`, replay latest on WS connect

**Steps:**

1. Add `GitFileEntry`, `GitFileStatus`, and `GitStatusUpdated` to `server/types.ts`. Add `GitStatusUpdated` to the `GlobalEvent` union. This automatically flows into `GlobalEventPayload` via `DistributiveOmit`.

2. Create `server/git-status-poller.ts` exporting:
   - `parseGitStatus(raw: string): Array<{ path: string; indexStatus: string; workTreeStatus: string }>` — parses `git status --porcelain=v1` output. Each line is `XY path` where X is index status, Y is work-tree status. Handle `??` for untracked, `!!` for ignored (filter ignored out), and `R` with `->` rename arrows (use the destination path).
   - `parseNumstat(raw: string): Map<string, { added: number; deleted: number }>` — parses `git diff --numstat` output. Each line is `added\tdeleted\tpath`. Binary files show `-\t-\tpath`; treat as 0/0.
   - `mergeGitData(statusEntries, stagedNumstat, unstagedNumstat): GitFileEntry[]` — joins status and numstat data. For each file: if it has an index status (`indexStatus !== "?" && indexStatus !== " "`), take line counts from `stagedNumstat`; if it has a work-tree status (`workTreeStatus !== " "`), add line counts from `unstagedNumstat`. Untracked files get 0/0.
   - `type GitStatusPollerOptions = { cwd: string; intervalMs: number; onUpdate: (files: GitFileEntry[]) => void }` 
   - `startGitStatusPoller(options): { stop: () => void }` — uses `setInterval`. On each tick: runs `git status --porcelain=v1`, `git diff --numstat`, and `git diff --cached --numstat` via `Bun.spawn` (all three in parallel). Parses output, merges, then deep-compares against previous result (JSON stringify comparison). If changed, calls `onUpdate`. If any git command fails (non-zero exit or stderr about "not a git repository"), log a warning and skip (UC-5). Store previous result to diff against next tick.

3. In `server/index.ts`:
   - Import `startGitStatusPoller`.
   - After server startup (in the `bridge.start().then(...)` block), call `startGitStatusPoller({ cwd: CWD, intervalMs: 3000, onUpdate })`. The `onUpdate` callback calls `store.appendGlobal({ type: "GitStatusUpdated", files })`.
   - Track `latestGitStatusEvent` the same way `latestSpecListEvent` is tracked — subscribe to the store, and on `GitStatusUpdated`, save the event and broadcast to all connected clients.
   - In `websocket.open`, replay `latestGitStatusEvent` to new connections (same pattern as `latestSpecListEvent`).

**Tests:**

- `parseGitStatus` correctly parses modified, added, deleted, renamed, and untracked entries
- `parseGitStatus` handles empty output (clean working tree)
- `parseNumstat` parses normal entries and binary file entries (dash/dash)
- `mergeGitData` joins status and numstat data, assigns 0/0 to untracked files
- `mergeGitData` sums staged + unstaged line counts for files that appear in both

## UC-2: Display files grouped by git status category

**Files:**
- `client/types.ts` — replace `fileChanges`/`FileChangeInfo` with `gitFiles`/`GitFileEntry`
- `client/slices/git-status-updated.ts` — new slice handling `GitStatusUpdated`
- `client/slices/index.ts` — register the new slice, remove file-change logic from tool-call slices
- `client/slices/tool-call-started.ts` — remove `fileChanges` tracking
- `client/slices/tool-call-completed.ts` — remove `fileChanges` patching
- `client/slices/session-switched.ts` — preserve `gitFiles` across session switches (same as `specs`)
- `client/reducer.ts` — update re-exports (remove `FileChangeAction`, `FileChangeInfo`; add `GitFileEntry`)
- `client/components/workspace.tsx` — replace Files section with grouped git status view
- `client/index.tsx` — pass `gitFiles` instead of `fileChanges` to `Workspace`

**Steps:**

1. In `client/types.ts`:
   - Add `GitFileEntry` type (path, indexStatus, workTreeStatus, linesAdded, linesDeleted).
   - Replace `fileChanges: FileChangeInfo[]` with `gitFiles: GitFileEntry[]` in `AppState`.
   - Update `initialState` to use `gitFiles: []`.
   - Remove `FileChangeAction` and `FileChangeInfo` types.

2. Create `client/slices/git-status-updated.ts`:
   ```ts
   export const gitStatusUpdatedSlice = createSlice("GitStatusUpdated", (state, event) => {
     return { ...state, gitFiles: event.files };
   });
   ```

3. In `client/slices/index.ts`: import and add `gitStatusUpdatedSlice`. Remove `toolCallStartedSlice` and `toolCallCompletedSlice`'s file-change logic (but keep their streaming content logic).

4. In `client/slices/tool-call-started.ts`: remove the `fileChanges` section entirely (the `extractFilePath`, `kindToAction` imports and the file-tracking block). Keep only the streaming content logic.

5. In `client/slices/tool-call-completed.ts`: remove the `fileChanges` patching block. Keep only the streaming content logic.

6. In `client/slices/session-switched.ts`: replace `fileChanges` reset. Since `gitFiles` is global (not per-session), preserve it across switches like `specs`:
   ```ts
   return { ...initialState, sessions: state.sessions, specs: state.specs, gitFiles: state.gitFiles, sessionId: event.sessionId };
   ```

7. In `client/reducer.ts`: update re-exports — remove `FileChangeAction`, `FileChangeInfo`; add `GitFileEntry`.

8. In `client/components/workspace.tsx`:
   - Replace the `fileChanges` prop with `gitFiles: GitFileEntry[]`.
   - Add a `groupGitFiles(files: GitFileEntry[])` helper that partitions files into three arrays: `staged` (indexStatus is not `" "` or `"?"`), `unstaged` (workTreeStatus is not `" "` and not `"?"`), and `untracked` (both statuses are `"?"`). A file can appear in both staged and unstaged.
   - Replace the Files section. When expanded, render up to three sub-sections (Staged, Unstaged, Untracked), each with a header showing section name and count. Hide sub-sections with zero files.
   - Replace the collapsed summary: show total file count (deduplicated — a file in both staged and unstaged counts once).

9. In `client/index.tsx`:
   - Replace `state.fileChanges` with `state.gitFiles` in the `workspaceVisible` condition and `Workspace` props.

**Tests:**

- `gitStatusUpdatedSlice` stores `event.files` into `state.gitFiles`
- `sessionSwitchedSlice` preserves `gitFiles` across switches
- `groupGitFiles` correctly partitions files into staged, unstaged, untracked
- `groupGitFiles` puts a file with both index and work-tree changes into both staged and unstaged

## UC-3: Show status icons per file

**Files:**
- `client/components/icons.tsx` — add `GitStatusIcon` component
- `client/components/workspace.tsx` — use `GitStatusIcon` in file rows

**Steps:**

1. In `client/components/icons.tsx`, add a `GitStatusIcon` component:
   - Props: `status: string` (the single-char git status), `size?: number`.
   - Icons (all SVG, consistent with existing icon style):
     - `"M"` (modified): pencil/edit icon, color `var(--color-warning)` (yellow/amber)
     - `"A"` (added): plus icon, color `var(--color-success)` (green)
     - `"D"` (deleted): minus icon, color `var(--color-error)` (red)
     - `"R"` (renamed): right-arrow icon, color `var(--color-info)` (blue)
     - `"?"` (untracked): question mark icon, color `var(--color-muted)` (gray)
     - Default: empty circle for unknown statuses

2. In `client/components/workspace.tsx`, replace `FileChangeRow` with a `GitFileRow` component:
   - Shows `GitStatusIcon` based on the relevant status character (use `indexStatus` for staged section, `workTreeStatus` for unstaged/untracked section — pass as a prop or determine from context).
   - Shows the file name (basename) with full path as tooltip.

**Tests:**

- `GitStatusIcon` renders without crashing for each status character (M, A, D, R, ?)

## UC-4: Show line-level change counts

**Files:**
- `client/components/workspace.tsx` — add line counts to `GitFileRow` and section header
- `client/style.css` — add styles for line count badges

**Steps:**

1. In the `GitFileRow` component (workspace.tsx):
   - After the file name, render `+N` in green and `-N` in red using `<span>` elements with appropriate CSS classes.
   - If both `linesAdded` and `linesDeleted` are 0 (untracked files), show nothing.

2. In the Files section header (collapsed summary):
   - Compute totals: `totalAdded = sum of linesAdded`, `totalDeleted = sum of linesDeleted`.
   - Display as `+N / -N` alongside the file count.

3. In `client/style.css`:
   - Add `.git-file__additions` (green text) and `.git-file__deletions` (red text) styles.
   - Add `.workspace__section-summary` styles for the total line counts in the header.

**Tests:**

- Files with non-zero line counts render both `+N` and `-N` indicators
- Files with 0/0 line counts render no indicators

## UC-6: Clean working tree

**Files:**
- `client/components/workspace.tsx` — handle empty `gitFiles` array

**Steps:**

1. The existing `hasFiles` check (`gitFiles.length > 0`) already controls whether the Files section renders. When `gitFiles` is empty, the section is hidden.

2. Update the `workspaceVisible` logic in `client/index.tsx` — `gitFiles` is global, so it's always present. The existing check (`state.gitFiles.length > 0`) handles this. When the working tree is clean and there are no plan entries or specs, the workspace sidebar hides automatically via the existing `!hasContent` empty-state logic.

No additional code needed — the existing conditional rendering handles UC-6. Verify with a test.

**Tests:**

- When `gitFiles` is empty, the Files section is not rendered
- When all sections are empty (no plan entries, no specs, no git files), the workspace shows the empty state message
