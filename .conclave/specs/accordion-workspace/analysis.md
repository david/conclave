# Accordion Workspace Sections

The workspace sidebar sections (Tasks, Files) should behave as an accordion — only one section expanded at a time, with collapsed sections showing summary info.

## Use Cases

### UC-1: Toggle section open/closed (High)
- **Actor:** End User
- **Summary:** User clicks a section header to expand it, which collapses the other section.
- **Given:** Both Tasks and Files sections have content; one section is currently expanded
- **When:** User clicks the header of the collapsed section
- **Then:**
  - The clicked section expands to show its full content
  - The previously expanded section collapses
  - Only one section is open at a time

### UC-2: Show summary on collapsed section (High)
- **Actor:** End User
- **Summary:** Collapsed section headers display a brief summary so the user can see status at a glance.
- **Given:** A section is collapsed and has content
- **When:** User views the workspace
- **Then:**
  - Collapsed Tasks header shows "X / Y completed" (completed count / total tasks)
  - Collapsed Files header shows "X files changed" (total file count)

### UC-3: Default to Tasks section expanded (Medium)
- **Actor:** System
- **Summary:** When tasks have content, the Tasks section is always the default expanded section.
- **Given:** Tasks section has content
- **When:** Workspace renders or tasks arrive for the first time
- **Then:**
  - Tasks section is expanded
  - All other sections are collapsed with their summaries visible

### UC-4: Expand first section when no tasks exist (Medium, depends on UC-3)
- **Actor:** System
- **Summary:** When there are no tasks, the first section to receive content becomes the default expanded section.
- **Given:** Tasks section has no content; no section is currently expanded
- **When:** A section (e.g., Files) receives its first content
- **Then:**
  - That section expands automatically
  - Subsequent sections that receive content remain collapsed with their summaries visible
