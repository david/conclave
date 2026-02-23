# Workspace Navigation

Replace the workspace side panel's single-open accordion with an icon bar + content drawer layout. A narrow vertical icon strip provides stable, always-visible section navigation. The content panel to its right displays the selected section's content with a title header. Modeled after VS Code's Activity Bar pattern.

## Decisions

- **Always-open drawer**: The content panel is always visible when a session is active. Clicking the already-active icon is a no-op — no toggle-to-close behavior.
- **No badges**: Icon bar is icons only, no badge counts or status indicators. Can be added later.
- **Crossfade transition**: Switching sections uses a subtle crossfade (opacity transition), not a slide or instant swap.
- **Section order**: Icons appear in fixed order — Services, Specs, Tasks, Files — matching the current accordion order.
- **Existing content unchanged**: The content within each section (task entries, file rows, spec entries, service rows) is unchanged. Only the navigation and layout wrapper changes.

## Use Cases

### UC-1: Switch section via icon bar (High)
- **Actor:** End User
- **Summary:** User clicks an icon in the vertical icon bar to switch which section's content is displayed in the content panel.
- **Given:** A session is active; the workspace is visible with the icon bar and content panel; a section (e.g. Tasks) is currently displayed
- **When:** The user clicks a different section icon (e.g. Files)
- **Then:**
  - The clicked icon becomes visually active (highlighted)
  - The previous icon loses its active state
  - The content panel crossfades to show the newly selected section's content
  - The content panel title updates to the selected section name

### UC-2: Auto-select first available section (High)
- **Actor:** System
- **Summary:** When session data first arrives, the system automatically selects the highest-priority section that has content.
- **Given:** A session is active; no section has been manually selected yet
- **When:** The first section receives data from the server
- **Then:**
  - The system selects the first non-empty section using priority order: services > tasks > files > specs
  - The selected section's icon becomes active
  - The content panel displays that section's content with its title

### UC-3: View section content with title header (High, depends on UC-1)
- **Actor:** End User
- **Summary:** Each section's content panel displays a title header identifying the current section, followed by the section's scrollable content.
- **Given:** A section is selected in the icon bar
- **When:** The user views the content panel
- **Then:**
  - A title header is displayed at the top of the content panel showing the section name (e.g. "Tasks", "Files")
  - The section's content is rendered below the title in a scrollable area
  - Content rendering matches the existing section content (task entries, file rows, spec entries, service rows)

### UC-4: Tasks override on arrival (Medium, depends on UC-2)
- **Actor:** System
- **Summary:** When tasks arrive after another section was auto-selected, the system switches to the tasks section.
- **Given:** A section other than Tasks was auto-selected (UC-2); Tasks section had no content
- **When:** Task data arrives from the server
- **Then:**
  - The active section switches to Tasks
  - The Tasks icon becomes active
  - The content panel crossfades to show task entries

### UC-5: Icon bar renders section icons (High)
- **Actor:** End User
- **Summary:** The icon bar displays a vertical stack of icons, one per section, in a fixed narrow column.
- **Given:** A session is active
- **When:** The workspace is visible
- **Then:**
  - A narrow vertical bar (~44px wide) is rendered to the left of the content panel
  - Four section icons are displayed vertically: Services, Specs, Tasks, Files
  - Icons are visually distinct and recognizable at small size
  - The active section's icon has a visual indicator distinguishing it from inactive icons

### UC-6: Three-column layout (High)
- **Actor:** End User
- **Summary:** The app layout changes from a two-column grid to a three-column grid: icon bar, content panel, and chat pane.
- **Given:** A session is active; the workspace is visible
- **When:** The user views the application
- **Then:**
  - The layout renders three columns: icon bar (~44px fixed), content panel (1fr), chat pane (2fr)
  - The icon bar and content panel replace the previous single workspace column
  - The chat pane occupies the remaining space

## Event Model

This spec is a **client-side UI refactoring** — no new domain events, commands, or server-side projections are needed. All data the workspace displays already flows through existing events:

| Section  | Existing Event          | Client State Field     |
|----------|------------------------|------------------------|
| Services | `ServiceStatusUpdated` | `services`, `servicesAvailable` |
| Specs    | `SpecListUpdated`      | `specs`                |
| Tasks    | `PlanUpdated`          | `planEntries`          |
| Files    | `GitStatusUpdated`     | `gitFiles`             |

Section selection (`activeSection`) is **local React state** — exactly as the current `expandedSection` is today. The auto-select and tasks-override behaviors (UC-2, UC-4) are `useEffect` hooks reacting to prop changes, not domain events.

### What changes

- **Workspace component** (`client/components/workspace.tsx`): Replace accordion layout with icon bar + content drawer. Extract `IconBar` and `ContentPanel` sub-components. Keep section content renderers (task entries, file rows, etc.) as-is.
- **App layout** (`client/index.tsx` + `client/style.css`): Change the two-column CSS grid to three columns (`44px 1fr 2fr`). The icon bar and content panel live inside the workspace column.
- **Icons** (`client/components/icons.tsx`): Add four section icons (Services, Specs, Tasks, Files) for the icon bar.
- **CSS** (`client/style.css`): New styles for `.icon-bar`, `.icon-bar__item`, `.content-panel`, `.content-panel__header`, crossfade transition.

### What stays the same

- All server-side code (events, commands, projections, slices, pollers)
- All client-side slices/reducers — `AppState` shape is unchanged
- Section content rendering (task entries, file rows, spec entries, service rows)
- Data flow: events arrive via WebSocket, reducer updates state, workspace re-renders
