# Git Status Files Panel

Replace the current tool-call-derived Files panel with a live view of `git status`, polled on an interval from the server. Shows staged, unstaged, and untracked files with status icons and per-file line change counts.

## Use Cases

### UC-1: Poll git status with diff stats (High)
- **Actor:** System
- **Summary:** Server periodically runs git status and git diff to collect file statuses and line-level change counts.
- **Given:** Server is running; working directory is a git repository
- **When:** Poll interval elapses; server executes `git status --porcelain=v1`, `git diff --numstat`, and `git diff --cached --numstat`
- **Then:**
  - Each file entry includes: path, index status, working tree status, lines added, and lines deleted
  - Untracked files get no line counts (or 0/0)
  - Results are compared to previous poll
  - If changed, a GitStatusUpdated event is broadcast to all connected WebSocket clients
  - If unchanged, no event is emitted

### UC-2: Display files grouped by git status category (High, depends on UC-1)
- **Actor:** End User
- **Summary:** Files panel groups entries into staged, unstaged, and untracked sections.
- **Given:** GitStatusUpdated event has been received
- **When:** Client processes the event
- **Then:**
  - Files are grouped into sections: staged, unstaged, and untracked
  - Each section header shows section name and file count
  - Panel summary in collapsed state shows total file count
  - Sections with no files are hidden

### UC-3: Show status icons per file (High, depends on UC-2)
- **Actor:** End User
- **Summary:** Each file row displays a distinct icon reflecting its git status.
- **Given:** Files panel is displaying git status entries
- **When:** A file entry is rendered
- **Then:**
  - Modified files show a pencil/edit icon
  - Added files show a plus icon
  - Deleted files show a minus icon
  - Renamed files show an arrow icon
  - Untracked files show a question mark icon
  - Icon color reflects the status category

### UC-4: Show line-level change counts (High, depends on UC-2)
- **Actor:** End User
- **Summary:** Each file row shows added/deleted line counts, and the Files header shows totals.
- **Given:** Files panel is displaying git status entries
- **When:** A file entry is rendered
- **Then:**
  - Each file shows +N in green and -N in red for lines added/deleted
  - Files with no diff data (untracked) show no line counts
  - The Files panel header shows total +N / -N across all files

### UC-5: Handle non-git working directory (Medium, depends on UC-1)
- **Actor:** System
- **Summary:** Server gracefully handles the case where the working directory is not a git repository.
- **Given:** Server is running; working directory is not a git repository
- **When:** Poll interval elapses; git status command fails
- **Then:**
  - No GitStatusUpdated event is emitted
  - Error is logged but does not crash the server
  - Files panel remains empty

### UC-6: Clean working tree (Medium, depends on UC-2)
- **Actor:** End User
- **Summary:** Files panel handles a clean working tree appropriately.
- **Given:** Server is polling git status; working tree is clean
- **When:** GitStatusUpdated event arrives with an empty file list
- **Then:**
  - Files section is hidden or shows empty state
  - Workspace sidebar hides if no other sections have content
