# Mobile UI

Conclave currently runs as a two-pane desktop app (workspace + chat). The goal is full-parity mobile support with PWA installability, so users can use Conclave on their phones as a native-feeling app.

## Findings

### Current State

The app already has partial responsive support:
- Viewport meta tag is set correctly (`client/index.html:5`)
- A 900px breakpoint (`client/style.css:2577`) stacks workspace above chat vertically (55%/45% split)
- CSS grid layout with flexbox internals — no hard-coded widths
- Relative units used throughout

### Problems on Mobile Today
- **Vertical split is unusable.** 45% screen for chat, minus keyboard (~half the screen), leaves almost no visible chat area.
- **Tap targets too small.** Many buttons are 32px (`client/style.css:138–139`, `client/style.css:164–165`) or 36px (`client/style.css:1429–1430`); Apple recommends 44px minimum.
- **No pane toggling.** On mobile the stacked layout means scrolling between panes instead of switching.
- **No touch feedback.** `:hover` states used throughout (`client/style.css` — 10+ occurrences including `:hover` on buttons, links, code blocks, thought blocks) but no `:active` or tap feedback styles.
- **No safe area handling.** iPhone notch/Dynamic Island, Android gesture bar not accounted for.
- **No `dvh` usage.** Mobile browsers include the URL bar in `vh` units, so content can overflow behind the keyboard or browser chrome. The codebase does not currently use `100vh` either, but will need `dvh` for full-screen mobile panes.

### Decisions

#### Navigation: Bottom Tab Bar
A bottom tab bar with two tabs (Workspace, Chat) for pane switching on mobile. Each tap shows one pane full-screen.

**Why not swipe-to-switch:** Conclave's chat content is heavily horizontal — code blocks, tool call outputs, markdown tables. Swipe gestures would constantly conflict with horizontal scrolling inside those elements. Bottom tabs avoid this entirely.

```
┌─────────────────────────┐
│                         │
│    [Active Pane]        │
│    (full screen)        │
│                         │
├─────────────────────────┤
│  Workspace   |   Chat   │
└─────────────────────────┘
```

The tab bar should only appear on mobile (below a breakpoint — likely 768px for phones, with the existing 900px breakpoint refined for tablets). On desktop the current side-by-side layout remains unchanged.

#### Viewport & Layout: Use `dvh` and `visualViewport` API
- Replace `100vh` with `100dvh` (dynamic viewport height) to account for mobile browser chrome.
- Use the `visualViewport` API to detect keyboard open/close and adjust layout accordingly, ensuring the input bar stays visible and the chat area doesn't collapse.

#### Tap Targets: 44px Minimum
All interactive elements (buttons, links, toggles) must be at least 44x44px on mobile. This applies to:
- Input bar send/cancel buttons
- Workspace icon bar buttons (currently 36px)
- Tool call expand/collapse toggles
- Session picker interactions

#### Touch Feedback
Add `:active` pseudo-class styles for all tappable elements on mobile to give immediate visual feedback (subtle background color change or scale). Remove reliance on `:hover` for mobile.

#### Safe Areas
Add `env(safe-area-inset-*)` padding, particularly:
- Bottom inset for the tab bar (iPhone home indicator, Android gesture bar)
- Top inset for status bar / Dynamic Island

#### Input Bar on Mobile
The input bar is the hardest part. When the virtual keyboard opens:
- The input bar must remain visible above the keyboard
- The message list should shrink, not get pushed offscreen
- Auto-scroll to keep the latest message visible

Modern approach: `position: sticky` at the bottom of a flex container, combined with `dvh` and `visualViewport` resize events.

#### Session Picker on Mobile
The `react-select` `CreatableSelect` dropdown is workable on mobile but not ideal. For the initial implementation, keep it as-is. Future iteration could replace it with a slide-out drawer or dedicated session list screen.

#### PWA: Installable App

**Manifest requirements:**
- `manifest.json` with `name`, `short_name`, `start_url`, `display: "standalone"`, theme/background colors, icons (192px + 512px)
- Link the manifest from `index.html`

**No service worker / offline support.** Conclave requires a live WebSocket connection to function — there's no meaningful offline mode. Skip the service worker entirely for now.

**Notifications (future):**
- Push notifications for long-running task completion ("Task complete", "Agent needs input")
- Requires a push subscription server and the Push API
- Not in scope for initial implementation, but the service worker infrastructure enables it later

#### Breakpoint Strategy

| Width | Layout |
|-------|--------|
| > 900px | Side-by-side (current desktop behavior) |
| 768–900px | Tablet — stacked with larger tap targets, possibly keep side-by-side in landscape |
| < 768px | Phone — bottom tab bar, single pane at a time, full mobile treatment |

## Open Questions

- **Landscape phone orientation:** Force portrait, or allow landscape with a horizontal split? Landscape on phones gives very little vertical space.
- **Tablet experience:** Is the current stacked layout at 900px good enough for tablets, or do tablets deserve their own treatment (e.g. side-by-side in landscape, tabs in portrait)?
- **Notification priority:** How soon do push notifications matter? They need server-side infrastructure (push subscription storage, web-push library).

## Leanings

- Start with phone-first (< 768px breakpoint), bottom tab bar, full-screen panes, PWA manifest (no service worker)
- Use `dvh` units and `visualViewport` API for keyboard-aware layout
- Increase all tap targets to 44px minimum
- Add safe area insets
- Defer push notifications and tablet-specific layout to later iterations
- Keep session picker as-is initially
