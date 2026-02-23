# Workspace Navigation

Rethinking the workspace side panel navigation. The current single-open accordion pushes section headers to unpredictable vertical positions, requiring long mouse travel to switch between sections.

## Problem

- Accordion scatters section headers vertically — their position depends on which section is open and how much content it has
- No stable anchor points for navigation — muscle memory doesn't help
- Switching from Tasks to Files (for example) requires moving the mouse to the bottom of the panel

## Explored Alternatives

1. **Tab bar** — horizontal tabs at top. Solves the problem but changes visual language, loses inline summaries.
2. **Fixed header stack** — all headers pinned to top, content below. Minimal departure from current design but slight visual disconnect between header and content.
3. **Icon bar + content drawer** — narrow vertical icon strip (always visible) with content panel to its right. Selected via user preference.

## Decision: Icon Bar + Content Drawer

Modeled after VS Code's Activity Bar pattern.

### Layout

```
[icon-bar: ~44px fixed] [content-panel: 1fr] [chat: 2fr]
```

- **Icon bar**: vertical stack of section icons, always visible when a session is active. Fixed width (~44px). Each icon represents one section (Services, Specs, Tasks, Files).
- **Content panel**: shows the selected section's content. Always open — clicking the active icon is a no-op. Clicking a different icon switches the content.
- **Chat pane**: takes remaining space at 2fr ratio.

### Behavior

- Always-open: one section is always showing, no toggle-to-close
- Clicking an icon switches which section's content is displayed
- Active icon gets a visual indicator (highlight bar, background change, or similar)
- Auto-select logic on first content arrival (same as current: services > tasks > files > specs priority)

### Icon Bar Details

- ~44px wide, vertically stacked icons
- Icons need to be distinct and recognizable at ~20px
- Existing icons (TaskIcon, GitStatusIcon, ServiceStatusIcon) may need toolbar variants
- No badge indicators for now — keep it minimal, icons only
- Badges can be added later if needed

### Layout Impact

- Replaces the current two-column grid (0fr/1fr ↔ 1fr/2fr) with a three-column model
- Icon bar is always present (when session active), content panel is always present
- Simpler than current approach — no workspace show/hide transition needed
- Mobile/narrow: needs consideration (icon bar + drawer + chat may be tight)

### Content Panel Details

- Each section has a title header at the top of the content area (e.g., "Tasks", "Files", "Services", "Specs")
- Reuses the existing section label styling (uppercase, display font)
- Switching sections uses a subtle crossfade transition

## Open Questions

- Specific icon designs for each section (reuse existing or new?)
- Mobile/responsive behavior — hide icon bar behind hamburger? Stack vertically?

## Decisions

- Always-open drawer (no collapse toggle)
- No badge indicators — icons only, keep it minimal
- Content panel has a title header per section
- Crossfade transition when switching sections
- Pattern modeled after VS Code Activity Bar
