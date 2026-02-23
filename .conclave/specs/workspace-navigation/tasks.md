# Workspace Navigation — Tasks

Two-wave strategy: wave 0 creates the section icons (independent file), wave 1 restructures the workspace component and CSS. UC-1 through UC-4 are merged into the restructuring task because they all modify `workspace.tsx` and describe behavior inseparable from the layout change.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Add section icons to icons.tsx",
    "ucs": ["UC-5"],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/icons.tsx"]
    },
    "description": "Add four exported icon components (ServicesIcon, SpecsIcon, TasksIcon, FilesIcon) to the existing icons.tsx file. Each is an SVG at 20×20 viewBox, stroke-based, matching existing icon conventions."
  },
  {
    "id": "T-1",
    "name": "Restructure workspace into icon bar + content panel",
    "ucs": ["UC-6", "UC-5", "UC-1", "UC-2", "UC-3", "UC-4"],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/workspace.tsx", "client/style.css"]
    },
    "description": "Replace the accordion layout with icon bar + content panel. Extract IconBar and ContentPanel sub-components, rename expandedSection to activeSection, wire click handlers, add crossfade transition, update CSS grid/flex layout, and remove accordion-specific styles. Existing tests must still pass."
  }
]
```

## Wave 0 (parallel)

### T-0: Add section icons to icons.tsx
- **UCs**: UC-5
- **Files**: modify `client/components/icons.tsx`
- **Summary**: Add four new section icon components for the icon bar. These are consumed by the workspace restructuring in T-1.
- **Steps**:
  1. In `icons.tsx`, add four exported icon components: `ServicesIcon`, `SpecsIcon`, `TasksIcon`, `FilesIcon`.
  2. Each is an SVG at 20×20 viewBox, stroke-based, accepting `size` and `className` props (matching existing `IconProps` pattern).
  3. Use distinctive shapes:
     - **ServicesIcon**: stacked horizontal bars (server/process)
     - **SpecsIcon**: document with lines
     - **TasksIcon**: checkbox/checklist
     - **FilesIcon**: branching git tree or file-diff icon
  4. Follow the existing code style in `icons.tsx` — each icon is a standalone exported function component.
- **Tests**: No new tests needed. Icons are pure presentational SVG components.
- **Validation**: `bun run check` passes with the new exports.

## Wave 1 (after wave 0)

### T-1: Restructure workspace into icon bar + content panel
- **UCs**: UC-6, UC-5, UC-1, UC-2, UC-3, UC-4
- **Depends on**: T-0
- **Files**: modify `client/components/workspace.tsx`, modify `client/style.css`
- **Summary**: Full workspace component restructuring — replaces the accordion with icon bar + content panel layout, wires all navigation behavior, and updates styles. This is the core task that implements all six use cases.
- **Steps**:

  **workspace.tsx changes:**
  1. Import the four new section icons from `icons.tsx` (`ServicesIcon`, `SpecsIcon`, `TasksIcon`, `FilesIcon`). Remove the `Chevron` import.
  2. Extract an `IconBar` sub-component rendered as a `<nav>` with class `.icon-bar`. It receives `activeSection`, `onSelect` callback, and visibility flags (`hasServices`, `hasSpecs`, `hasEntries`, `hasFiles`). Renders all four icons in fixed order (Services, Specs, Tasks, Files). Icons for empty sections are rendered but visually dimmed (`.icon-bar__item--dimmed`). Active icon gets `.icon-bar__item--active`.
  3. Extract a `ContentPanel` sub-component. It receives `activeSection` and all data props. Renders:
     - `.content-panel__header` div showing the section name (map `SectionId` → display name: `{ services: "Services", specs: "Specs", tasks: "Tasks", files: "Files" }`)
     - `.content-panel__body` div with the existing section content renderers (task entries, file rows, spec entries, service rows) — moved from the current accordion body blocks. Content body uses `key={activeSection}` for crossfade.
  4. Rename `expandedSection` → `activeSection`, `autoExpandedRef` → `autoSelectedRef`. Change `handleToggle` to `handleSelect(section: SectionId)` — simply sets active section (clicking already-active icon is idempotent, no toggle-to-close).
  5. The `Workspace` component's return changes from the accordion to: `.workspace` containing `IconBar` (left) + `ContentPanel` (right) via `display: flex`.
  6. Keep the existing `useEffect` for auto-select (UC-2) — just rename state references. Priority: services > tasks > files > specs.
  7. Keep the existing `useEffect` for tasks override (UC-4) — just rename state references.

  **style.css changes:**
  8. Inside `.workspace`, use `display: flex` with `.icon-bar` (44px fixed) and `.content-panel` (flex: 1). The app-level grid (`workspace | chat`) stays as two columns.
  9. Add new CSS classes:
     - `.icon-bar` — `width: 44px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 12px 0; gap: 4px; border-right: 1px solid var(--border);`
     - `.icon-bar__item` — `width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-muted); transition: background 0.15s, color 0.15s;`
     - `.icon-bar__item:hover` — `background: var(--bg-hover); color: var(--text-secondary);`
     - `.icon-bar__item--active` — `color: var(--text); background: var(--bg-elevated);` with a left-edge accent (2px left border or `::before` pseudo-element)
     - `.icon-bar__item--dimmed` — `opacity: 0.3; pointer-events: none;`
     - `.content-panel` — `flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;`
     - `.content-panel__header` — `font-family: var(--font-display); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); padding: 16px 18px 8px;`
     - `.content-panel__body` — `flex: 1; min-height: 0; overflow-y: auto; padding: 0 18px 16px;`
     - Crossfade animation keyframe: `@keyframes crossfade { from { opacity: 0; } to { opacity: 1; } }` applied to `.content-panel__body` via `animation: crossfade 0.15s ease-out`.
  10. Remove accordion-specific CSS: `.workspace__section-header`, `.workspace__section-summary`, chevron usage in workspace, `.workspace__*-section` border-top separators.
  11. Keep all inner content styles untouched: `.plan-entry`, `.file-change`, `.service-row`, `.spec-entry`, etc.
  12. Update `@media (max-width: 900px)` — workspace still stacks above chat; icon bar + content panel remain within the workspace column.

- **Tests**: Existing tests (`groupGitFiles`, `GitFileRow`, `filesSummary`) must still pass — they test pure functions whose signatures don't change. Run `bun test client/` to verify.
- **Validation**: `bun run check` passes. `bun test client/` passes. Visual inspection confirms icon bar + content panel layout.
