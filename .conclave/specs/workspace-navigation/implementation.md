# Workspace Navigation — Implementation

Replace the workspace's single-open accordion with an icon bar + content drawer layout. This is a purely client-side refactoring — no server changes, no new events, no state shape changes. The workspace component gets restructured into three sub-parts (icon bar, content panel header, content panel body), the app-level CSS grid gains a third column, and four new section icons are added. All existing section content renderers (task entries, file rows, spec entries, service rows) remain unchanged.

## New Types

No new TypeScript types are needed in `types.ts`. The existing `SectionId` union type in `workspace.tsx` already defines `"services" | "specs" | "tasks" | "files"` and is reused for active section tracking. The `activeSection` state replaces the current `expandedSection` state — same type, different semantics (always has a value when content exists, never null once auto-selected).

## UC-6 + UC-5: Three-Column Layout and Icon Bar

These are implemented together because UC-6 defines the grid structure that UC-5's icon bar lives inside.

**Files:**
- `client/style.css` — Update grid and add icon bar / content panel styles
- `client/components/workspace.tsx` — Restructure into icon bar + content panel
- `client/components/icons.tsx` — Add four section icons

**Steps:**

1. In `icons.tsx`, add four exported icon components: `ServicesIcon`, `SpecsIcon`, `TasksIcon`, `FilesIcon`. Each is an SVG at 20×20 viewBox, stroke-based, matching the existing icon conventions (props: `size`, `className`). Use distinctive shapes:
   - Services: stacked horizontal bars (server/process)
   - Specs: document with lines
   - Tasks: checkbox/checklist
   - Files: branching git tree or file-diff icon

2. In `workspace.tsx`, extract a new `IconBar` component rendered as a `<nav>` with class `.icon-bar`. It receives `activeSection`, `onSelect` callback, and visibility flags (`hasServices`, `hasSpecs`, `hasEntries`, `hasFiles`). It renders all four icons in fixed order (Services, Specs, Tasks, Files) — icons for empty sections are rendered but visually dimmed (reduced opacity). The active icon gets a `.icon-bar__item--active` class.

3. In `workspace.tsx`, extract a `ContentPanel` component that wraps the section title header and the scrollable section content. It receives `activeSection` and the data props. It renders:
   - A `.content-panel__header` div showing the section name as text
   - A `.content-panel__body` div with the existing section content renderers (moved from the current accordion body blocks)

4. The `Workspace` component's return changes from the accordion pattern to: `.workspace` containing `.icon-bar` (left) + `.content-panel` (right) via `display: flex`.

5. In `style.css`, update `.app-layout--workspace-visible` grid to `grid-template-columns: auto 1fr 2fr` — the `auto` column sizes to the icon bar's intrinsic width. Alternatively, keep the workspace as a single grid column and use flexbox internally. The simpler approach: keep the two-column grid (`workspace | chat`) but inside `.workspace` use `display: flex` with `.icon-bar` (44px fixed) and `.content-panel` (flex: 1).

6. In `style.css`, add new classes:
   - `.icon-bar` — `width: 44px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 12px 0; gap: 4px; border-right: 1px solid var(--border);`
   - `.icon-bar__item` — `width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-muted); transition: background 0.15s, color 0.15s;`
   - `.icon-bar__item:hover` — `background: var(--bg-hover); color: var(--text-secondary);`
   - `.icon-bar__item--active` — `color: var(--text); background: var(--bg-elevated);` with a left-edge accent indicator (2px left border or `::before` pseudo-element)
   - `.icon-bar__item--dimmed` — `opacity: 0.3; pointer-events: none;`
   - `.content-panel` — `flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;`
   - `.content-panel__header` — section title styling using `var(--font-display)`, uppercase, small, muted
   - `.content-panel__body` — `flex: 1; min-height: 0; overflow-y: auto; padding: 0 18px 16px;`

7. Remove the accordion-specific CSS: `.workspace__section-header`, `.workspace__section-summary`, the chevron usage in workspace, and the `.workspace__*-section` border-top separators. Keep the inner content styles (`.plan-entry`, `.file-change`, `.service-row`, `.spec-entry`, etc.) untouched.

8. Update the responsive breakpoint (`@media max-width: 900px`) — the icon bar + content panel still stack within the workspace column, so the existing behavior (workspace above, chat below) should continue to work.

**Tests:**
- `workspace.test.ts`: Existing `groupGitFiles`, `GitFileRow`, and `filesSummary` tests are unaffected (pure functions). No new unit tests needed for layout changes — those are visual. Existing tests pass as-is since exported functions don't change signatures.

## UC-1: Switch Section via Icon Bar

**Files:**
- `client/components/workspace.tsx` — Wire click handler

**Steps:**

1. Rename `expandedSection` state to `activeSection`. Change initial value from `null` to `null` (same — gets set by auto-select).

2. Replace `handleToggle` with `handleSelect(section: SectionId)`: simply `setActiveSection(section)`. No toggle-to-close — clicking the already-active icon is a no-op (guarded by `if (section !== activeSection) return` or let the state set be idempotent).

3. The `IconBar` component passes `onSelect={handleSelect}` to each icon button. Each button has `onClick={() => onSelect(sectionId)}`.

**Tests:**
- No new unit tests for click wiring — this is pure React event handler plumbing. The behavior is validated through UC-3's content display.

## UC-2: Auto-Select First Available Section

**Files:**
- `client/components/workspace.tsx` — Adjust existing `useEffect`

**Steps:**

1. The existing auto-expand `useEffect` already does exactly this: it checks `hasServices → hasEntries → hasFiles → hasSpecs` and sets the section. Rename the state variable from `expandedSection` to `activeSection` and update the priority order to match the spec: services > tasks > files > specs (the current code has services > tasks > files > specs, which already matches except the analysis says `services > tasks > files > specs` — verify and align).

   Actually the analysis states priority: `services > tasks > files > specs`. The current code has: `hasServices → hasEntries(tasks) → hasFiles → hasSpecs`. This already matches.

2. Keep the `autoExpandedRef` guard so manual selections aren't overridden. Rename to `autoSelectedRef` for clarity.

**Tests:**
- Auto-select is existing behavior with a rename — existing tests (if any) still pass. The logic is a `useEffect` hook, which is inherently integration-level. No pure-function test needed.

## UC-4: Tasks Override on Arrival

**Files:**
- `client/components/workspace.tsx` — Keep existing `useEffect`

**Steps:**

1. The existing `useEffect` that watches `hasEntries` and switches to tasks when they first appear already implements this behavior exactly. Rename `expandedSection` references to `activeSection`.

**Tests:**
- No changes needed — existing behavior preserved.

## UC-3: View Section Content with Title Header

**Files:**
- `client/components/workspace.tsx` — `ContentPanel` sub-component
- `client/style.css` — Content panel header styles

**Steps:**

1. The `ContentPanel` component (created in UC-6+UC-5) renders a header showing the active section name. Map `SectionId` to display names: `{ services: "Services", specs: "Specs", tasks: "Tasks", files: "Files" }`.

2. The content area renders the existing section content based on `activeSection`:
   - `"services"` → `ServiceRow` list (or "unavailable" message)
   - `"specs"` → `SpecEntry` / `EpicGroupRow` list (using existing `groupSpecs`)
   - `"tasks"` → `PlanEntry` list
   - `"files"` → `GitFileRow` list (using existing `sortedGitFiles`)

3. Add crossfade transition: wrap the content body in a keyed container (`key={activeSection}`) with CSS opacity transition. Add `.content-panel__body` animation: `animation: crossfade 0.15s ease-out` via a keyframe that goes from `opacity: 0` to `opacity: 1`.

4. Style the header: `.content-panel__header` uses `font-family: var(--font-display); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); padding: 16px 18px 8px;`.

**Tests:**
- No new pure-function tests. Content rendering is existing logic moved into a new container. The crossfade is CSS-only.
