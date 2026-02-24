# Mobile UI — Implementation

This spec transforms Conclave into a mobile-friendly PWA. The approach is phone-first (< 768px), adding a bottom tab bar for pane switching, full-screen single-pane views, 44px minimum tap targets, differentiated touch feedback, safe area handling, `dvh`-based layout with `visualViewport` keyboard awareness, and a PWA manifest for installability. Desktop layout (> 900px) stays unchanged. No service worker or offline support.

## Breakpoint & CSS Infrastructure

**Files:**
- `client/style.css` — refine existing 900px breakpoint, add 768px phone breakpoint, introduce `dvh` units and safe area variables
- `client/index.html` — add `viewport-fit=cover`

**Steps:**
1. Add safe area CSS custom properties at `:root`:
   ```css
   --safe-top: env(safe-area-inset-top, 0px);
   --safe-bottom: env(safe-area-inset-bottom, 0px);
   --safe-left: env(safe-area-inset-left, 0px);
   --safe-right: env(safe-area-inset-right, 0px);
   ```
2. In `client/index.html`, update the viewport meta tag to include `viewport-fit=cover`:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
   ```
3. Refine the existing `@media (max-width: 900px)` breakpoint — keep it for tablet (stacked layout with both panes visible, larger tap targets).
4. Add `@media (max-width: 768px)` breakpoint for phone layout — this is where the bottom tab bar, single-pane views, and full mobile treatment activate.
5. Inside the 768px breakpoint, set `.app-layout` to `display: flex; flex-direction: column; height: 100dvh;` and remove the grid template. Only one pane is visible at a time (controlled by class toggling — see Bottom Tab Bar section). Use `100dvh` directly — browser support is 96%+ and the `vh` fallback defeats the purpose. No CSS variable indirection needed.
6. Inside the 768px breakpoint, add `overscroll-behavior: contain` on `.message-list` and any horizontal-scrolling containers (code blocks, tables, `.em-diagram`) to prevent scroll-chaining from hijacking the outer pane.

**Tests:**
- Visual/manual: verify that at 769px+ the layout matches current desktop behavior exactly (no regression)
- Visual/manual: verify that at 768px and below, the app fills the viewport correctly, including when the mobile browser URL bar shows/hides

## Bottom Tab Bar Navigation

**Files:**
- `client/components/tab-bar.tsx` — new component, bottom tab bar with Workspace and Chat tabs
- `client/index.tsx` — add mobile pane state, render `TabBar`, toggle pane visibility
- `client/style.css` — tab bar styles inside the 768px breakpoint

**Steps:**
1. Create `client/components/tab-bar.tsx`: a component that renders two tabs with inline SVG icons (grid/layout icon for Workspace, chat-bubble icon for Chat) and text labels. Accepts `activePane: "workspace" | "chat"`, `onSwitch(pane)` callback, and optional `chatNotification: boolean` prop (see step 8). Renders `<nav className="tab-bar">` with two `<button>` elements.
2. In `client/index.tsx`, add `mobilePane` state (`"workspace" | "chat"`, default `"chat"`). Detect mobile via `window.matchMedia("(max-width: 768px)")` with a resize listener that resets to desktop layout when the window grows past 768px.
3. When on mobile, render `<TabBar>` after `<Chat>` / `<Workspace>`, and apply `.pane--hidden` (`display: none`) on the inactive pane.
4. When not on mobile, don't render `<TabBar>` and use existing desktop layout unchanged.
5. CSS for `.tab-bar`: `position: fixed; bottom: 0; left: 0; right: 0; height: 56px;` (56px *above* the safe area), flex row, two equal-width buttons, `background: var(--bg-surface)`, `border-top: 1px solid var(--border)`, `padding-bottom: var(--safe-bottom)`. Z-index above content. Each tab button: flex column, icon above label, `font-size: 10px`, `font-weight: 600`, `font-family: var(--font-body)`, `letter-spacing: 0.04em`, `text-transform: uppercase`.
6. Active tab: `color: var(--accent)` for both icon and text, with a `2px` accent-colored top border on the button (matching the `::before` stripe pattern from `.icon-bar__item--active`). Inactive tab: `color: var(--text-muted)`.
7. Pane switch applies a crossfade transition on the entering pane — reuse the existing `@keyframes crossfade` (150ms opacity 0→1) as a class `.pane--entering` applied briefly via `requestAnimationFrame`.
8. Ensure `.app-layout` on mobile has `padding-bottom: calc(56px + var(--safe-bottom))` to avoid content hiding behind the tab bar.
9. **Notification dot on chat tab:** When the user is on the workspace tab and `isProcessing` transitions to `false` (turn completed), or a new `AgentText` event arrives, show a pulsing amber dot on the chat tab. Reuse the existing `@keyframes mic-pulse` from `client/style.css` (already defined for voice-dictation) with `var(--accent)` color. Clear the dot when the user switches to chat. Pass a `chatNotification` boolean prop to `TabBar`.

**Stub for TDD:**
Create a minimal `client/components/tab-bar.tsx` stub that exports a `TabBar` component rendering `null`. This allows the Red test phase to import the module and fail on *assertions* (missing DOM elements, missing callbacks) rather than on import errors. The Green phase will replace the stub with the real implementation.

**Tests:**
- `client/components/tab-bar.test.ts` — renders two tab buttons with icons and labels; clicking a tab calls `onSwitch` with the correct pane name; active tab has the active class; notification dot renders when `chatNotification` is true
- Visual/manual: tab bar only appears at ≤768px, disappears at wider widths; crossfade on pane switch feels smooth

## Tap Target Sizing

**Files:**
- `client/style.css` — increase touch targets inside the 768px and 900px breakpoints
- `client/components/chat.tsx` — add react-select mobile styles

**Steps:**
1. Inside `@media (max-width: 900px)`, increase `.chat__new-session-btn` and `.chat__copy-session-btn` from 32px to 44px (width and height). Adjust icon font-size proportionally.
2. Inside `@media (max-width: 900px)`, increase `.icon-bar__item` from 36px to 44px. Increase the `.icon-bar` width from 44px to 52px to accommodate. (This only applies to the tablet breakpoint — on phone, the icon bar is hidden; see Workspace Mobile Layout section.)
3. Inside `@media (max-width: 900px)`, ensure `.input-bar__btn` has `min-height: 44px; min-width: 44px`.
4. Inside `@media (max-width: 900px)`, ensure `.tool-call__header` has `min-height: 44px` and `.tool-call-group__summary` has `min-height: 44px` for expand/collapse tapping.
5. Inside `@media (max-width: 900px)`, ensure `.plan-entry` rows have at least 44px height.
6. `.code-block__copy` button — increase to 44px touch target on mobile (can use padding to expand hit area without changing visual size).
7. In `client/components/chat.tsx`, pass mobile-aware `styles` to the `react-select` `CreatableSelect` component: increase `control` min-height to 44px at ≤900px via a media query check or inline style. Add `menuPortalTarget={document.body}` so the dropdown renders above the tab bar on mobile.

**Tests:**
- Visual/manual: all interactive elements meet 44px minimum at 900px and below
- Visual/manual: session picker dropdown opens correctly on mobile, not clipped by layout containers

## Touch Feedback

**Files:**
- `client/style.css` — add `:active` states, consolidate `:hover` rules under `@media (hover: hover)`

**Steps:**
1. Move all existing `:hover` pseudo-class rules into a single `@media (hover: hover) { ... }` block at the end of the file (after the responsive section). This consolidates ~29 hover rules in one place, preventing scattered `@media` nesting throughout the file. Maintain the same selector specificity.
2. Add `:active` pseudo-class styles, differentiated by element type:
   - **Chunky buttons** (`.input-bar__btn--send`, `.input-bar__btn--cancel`, `.input-bar__btn--mic`): `transform: scale(0.95)` — these are prominent action buttons where physical press feedback feels right.
   - **Icon buttons** (`.chat__new-session-btn`, `.chat__copy-session-btn`, `.code-block__copy`): `background: var(--accent-subtle); border-color: var(--accent); color: var(--accent)` — match their existing hover treatment, applied instantly on touch.
   - **Row/list items** (`.tool-call__header`, `.tool-call-group__summary`, `.plan-entry`, `.file-change`, `.service-row`, `.spec-entry`, `.icon-bar__item`): `background: var(--bg-hover)` — these are list items, not buttons, so a background color shift is more natural than scale.
   - **Thought blocks** (`.thought-block__header`): `background: var(--bg-elevated)` — match existing hover.
3. Inside the 768px breakpoint, add `-webkit-tap-highlight-color: transparent` on `body` to suppress the default blue/gray flash on iOS/Android, since we provide our own feedback.
4. Ensure existing `:active` on `.input-bar__btn` (`transform: scale(0.96)`) is preserved and not overridden by the new rules.

**Tests:**
- Visual/manual: tap any button on mobile simulator — immediate visual feedback appropriate to element type
- Visual/manual: hover on desktop still works as before (no regression from the `@media (hover: hover)` consolidation)

## Safe Area Handling

**Files:**
- `client/style.css` — apply safe area insets to key layout elements

**Steps:**
1. Inside the 768px breakpoint, apply `padding-top: var(--safe-top)` to `.chat__header` so the header sits below the notch/Dynamic Island.
2. Inside the 768px breakpoint, apply `padding-top: var(--safe-top)` to `.content-panel__header` in the workspace pane — when viewing workspace full-screen on mobile, it also needs notch clearance.
3. Apply `padding-bottom: var(--safe-bottom)` to `.tab-bar` (already covered in Tab Bar section).
4. Inside the 768px breakpoint, apply `padding-left: var(--safe-left)` and `padding-right: var(--safe-right)` to `.app-layout` for landscape orientation safe areas.
5. The input bar's bottom positioning is handled by the tab bar's safe area padding when the tab bar is visible. When the keyboard is open, the tab bar hides via `transform: translateY(100%)` and the flex + `dvh` layout compresses naturally — the input bar stays at the bottom of the visual viewport without additional positioning.

**Tests:**
- Visual/manual: on iPhone with notch (or simulator), content doesn't overlap the notch or home indicator in both chat and workspace panes
- Visual/manual: in landscape, content doesn't overlap the sensor housing

## Workspace Mobile Layout

**Files:**
- `client/components/workspace.tsx` — adapt for full-screen mobile display
- `client/style.css` — workspace mobile styles inside 768px breakpoint

**Steps:**
1. Inside the 768px breakpoint, hide the vertical `.icon-bar` entirely (`display: none`). On mobile the user already navigated to the workspace via the tab bar — the icon bar is redundant pane-level navigation.
2. Replace the icon bar with a horizontal section switcher at the top of the workspace content panel. Render a row of compact pill-shaped buttons (Services, Specs, Tasks, Files) below the `content-panel__header`. Style: `display: flex; gap: 6px; padding: 0 16px 10px;` with each pill as `font-size: 11px; font-weight: 600; padding: 6px 14px; border-radius: var(--radius-pill); min-height: 36px;`. Active pill: `background: var(--accent-subtle); color: var(--accent); border: 1px solid rgba(212, 148, 76, 0.2)`. Inactive: `background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--border)`.
3. Reuse the existing `activeSection` state from `workspace.tsx` — the section switcher drives the same state, just with a different UI control.
4. Dimmed/disabled sections (no data) show `opacity: 0.35; pointer-events: none` — same as the existing `.icon-bar__item--dimmed` behavior.
5. The workspace content panel expands to full width (no icon bar eating 44px). Apply `padding: 0 16px` to give mobile-appropriate margins.

**Tests:**
- Visual/manual: on mobile, workspace shows horizontal section pills instead of vertical icon bar
- Visual/manual: section switching works, dimmed sections match desktop behavior
- Visual/manual: on desktop (> 768px), icon bar renders normally (no regression)

## Input Bar & Keyboard Handling

**Files:**
- `client/hooks/use-visual-viewport.ts` — new hook that tracks `visualViewport` resize events
- `client/index.tsx` — integrate viewport hook for tab bar visibility
- `client/style.css` — mobile input bar and keyboard-aware layout

**Steps:**
1. **Primary approach — flex + `dvh` handles most of the work.** The `.chat` pane is already `display: flex; flex-direction: column`. `.message-list` is `flex: 1` and scrolls. The input bar sits at the natural bottom. With `100dvh` on the outer layout, when the mobile keyboard opens the viewport shrinks and the flex layout compresses — the input bar stays at the bottom of the visual viewport automatically. No `position: sticky` or `margin-bottom` hacks needed.
2. Create `client/hooks/use-visual-viewport.ts`: a hook that returns `{ viewportHeight: number, keyboardOpen: boolean }`. Subscribe to `window.visualViewport` `resize` events. Derive `keyboardOpen` by comparing `visualViewport.height < window.innerHeight * 0.75`.
3. **Tab bar hides when keyboard is open.** In `client/index.tsx`, use the `useVisualViewport` hook. When `keyboardOpen` is true, add a `.tab-bar--hidden` class that applies `transform: translateY(100%)` with a 150ms transition. This prevents the tab bar from eating space above the keyboard. When the keyboard closes, the tab bar slides back in.
4. **Auto-scroll on keyboard open.** When `keyboardOpen` transitions from `false` to `true`, scroll `.message-list` to the bottom after a 300ms delay (matching iOS keyboard animation duration). Use `scrollTo({ top: scrollHeight, behavior: 'smooth' })`. Avoid the 100ms debounce — it fires mid-animation and causes jank.
5. On mobile (768px breakpoint), reduce `.input-bar` padding to `8px 12px 12px` for tighter spacing near the keyboard. Reduce `.input-bar__textarea` padding to `8px 14px` and `min-height: 38px`.

**Stub for TDD:**
Create a minimal `client/hooks/use-visual-viewport.ts` stub that exports a `useVisualViewport` hook returning `{ viewportHeight: window.innerHeight, keyboardOpen: false }`. This allows the Red test phase to import the module and fail on *assertions* (wrong values after resize events) rather than on import errors. The Green phase will replace the stub with the real implementation.

**Tests:**
- `client/hooks/use-visual-viewport.test.ts` — mock `window.visualViewport` with a resize event; verify hook returns updated height and `keyboardOpen` state; verify `keyboardOpen` flips at the 75% threshold
- Visual/manual: open keyboard on mobile — input bar stays visible, tab bar slides away, message list scrolls to bottom; close keyboard — tab bar slides back, layout returns to normal

## Horizontal Overflow & Scroll Containment

**Files:**
- `client/style.css` — mobile scroll behavior for code blocks, tables, and diagrams

**Steps:**
1. Inside the 768px breakpoint, add to `.message__text--markdown pre code`, `.message__text--markdown table`, and `.em-diagram`:
   ```css
   -webkit-overflow-scrolling: touch;
   overscroll-behavior-x: contain;
   ```
   This prevents horizontal swipes inside code blocks and tables from accidentally scrolling the outer pane.
2. For `.message__text--markdown table`, wrap in `overflow-x: auto` with `display: block` on the table container (the parent `<div>` or the table itself) inside the 768px breakpoint so wide tables scroll horizontally within their container.
3. For `.em-diagram__slices`, ensure `overscroll-behavior-x: contain` is applied so multi-slice event model diagrams scroll horizontally without affecting the pane.

**Tests:**
- Visual/manual: swipe horizontally on a code block or wide table — only the inner content scrolls, not the chat pane
- Visual/manual: swipe vertically on the message list while touching a code block — vertical scroll still works normally

## PWA Manifest & Installability

**Files:**
- `client/manifest.json` — new PWA manifest
- `client/index.html` — link manifest, add `theme-color` meta, add apple-touch-icon
- `server/index.ts` — verify static file serving covers manifest and icons

**Steps:**
1. Create `client/manifest.json`:
   ```json
   {
     "name": "Conclave",
     "short_name": "Conclave",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#09090b",
     "theme_color": "#09090b",
     "icons": [
       { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
     ]
   }
   ```
   Use `#09090b` (the actual `--bg` value) for both `background_color` and `theme_color`. This ensures the iOS splash screen and Android status bar match the app's true background — not `#111111` which is `--bg-surface`.
2. In `client/index.html`, add inside `<head>`:
   ```html
   <link rel="manifest" href="/manifest.json" />
   <meta name="theme-color" content="#09090b" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
   <link rel="apple-touch-icon" href="/icon-192.png" />
   ```
3. Create app icons using the existing brand vocabulary: `#09090b` background with an amber `#d4944c` diamond shape (the rotated square from `.next-block__diamond`) centered, at 192px and 512px. This is already a recognizable element in the UI and makes for a distinctive home screen icon. Generate as PNG — can use an HTML canvas script or SVG-to-PNG conversion.
4. Ensure the build process copies `manifest.json` and icons to `dist/`. Check if Bun's build config or `server/index.ts` static file serving already handles this. If not, add them to the build copy step.
5. Verify `server/index.ts` serves files from `dist/` — if `manifest.json` and icons land there, they'll be served automatically.

**Tests:**
- Visual/manual: open Chrome DevTools → Application → Manifest — verify manifest loads correctly with `#09090b` colors
- Visual/manual: on Android Chrome, "Add to Home Screen" prompt appears; on iOS Safari, "Add to Home Screen" produces a standalone app with the diamond icon
- Verify `theme-color` changes the browser address bar color to match the obsidian background

## Font Loading Optimization

**Files:**
- `client/index.html` — refine Google Fonts URL

**Steps:**
1. Update the Google Fonts `<link>` URL to request only the weights actually used:
   - Bricolage Grotesque: weights 600 and 700 only (400 is not used — all usages are headings, labels, and display text at 600+)
   - Outfit: weights 400, 500, 600, 700 (all used)
   - JetBrains Mono: weights 400, 500 (unchanged)
2. Verify `&display=swap` is present in the URL (it already is). This ensures text renders immediately with system fonts, then swaps to the custom fonts once loaded — critical for mobile where font downloads may take longer.
3. No other changes — the existing `preconnect` hints for `fonts.googleapis.com` and `fonts.gstatic.com` are already present and correct.

**Tests:**
- Visual/manual: fonts still render correctly on desktop and mobile
- DevTools Network tab: confirm fewer font file requests (dropping Bricolage Grotesque weight 400 saves one file)
