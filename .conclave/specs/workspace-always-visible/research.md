# Workspace Always Visible on Desktop

The workspace sidebar is conditionally hidden on desktop when there's no content to display. We want it always visible instead, since upcoming additions will ensure it always has meaningful content.

## Findings

### Current visibility logic

The workspace visibility is controlled by a two-gate system in `client/index.tsx`:

```typescript
const workspaceVisible = !!state.sessionId && (
  state.planEntries.length > 0 ||
  state.gitFiles.length > 0 ||
  state.specs.length > 0 ||
  state.services.length > 0
);
```

This `workspaceVisible` flag drives two things:

1. **CSS layout class** — `app-layout--workspace-visible` toggles the grid from `0fr 1fr` (collapsed) to `1fr 2fr` (visible). The workspace also transitions from `opacity: 0` to `opacity: 1`.
2. **Component rendering** — On mobile, the `<Workspace>` component is conditionally rendered based on tab selection. On desktop, it's always rendered in the DOM but visually hidden via the CSS when the flag is false.

### What needs to change

On desktop, the workspace should always be visible — no content gate. The fix is to decouple the desktop layout from the content check:

- **`workspaceVisible` on desktop**: always `true` (remove the content-length conditions)
- **`workspaceVisible` on mobile**: keep current behavior (content gate still applies, workspace only shown when user switches to the workspace tab)
- **Layout ratio**: keep `1fr 2fr` unchanged
- **Empty state**: the existing `"Tasks and file changes will appear here."` placeholder in `workspace.tsx` will now actually be seen, which is fine — more content sources are planned

### Files involved

- `client/index.tsx` — `workspaceVisible` computation and `layoutClasses` construction
- `client/style.css` — no changes needed (the `0fr`→`1fr 2fr` transition and opacity animation still work)
- `client/components/workspace.tsx` — no changes needed (already handles empty state)

## Open Questions

None — scope is clear.

## Leanings

- Remove the content gate for desktop entirely rather than adding an "always show" flag. The content gate only served to avoid an empty sidebar, and that concern is going away as more workspace sections are added.
- Mobile behavior stays unchanged — the workspace tab should still only appear when there's content to show.
