# PWA Not Installable — Implementation

Three independent defects prevent PWA installation: the manifest lacks required icon size entries, no service worker exists, and the compiled binary doesn't embed PWA assets. Each section below fixes one defect.

## Manifest Icon Sizes

**Files:**
- `client/manifest.json` — add explicit size entries

**Steps:**
1. Add two entries to the `icons` array: `{ "src": "/icon.svg", "sizes": "192x192", "type": "image/svg+xml" }` and `{ "src": "/icon.svg", "sizes": "512x512", "type": "image/svg+xml" }`. Keep the existing `"sizes": "any"` entry.

## Service Worker

**Files:**
- `client/sw.js` — new file, minimal network-only service worker
- `client/index.html` — register the service worker

**Steps:**
1. Create `client/sw.js` with a `fetch` event listener that passes all requests through to the network (`event.respondWith(fetch(event.request))`). Include a minimal `install` handler that calls `self.skipWaiting()` and an `activate` handler that calls `self.clients.claim()` so it activates immediately.
2. In `client/index.html`, add a `<script>` block before the closing `</body>` tag that calls `navigator.serviceWorker.register('/sw.js')` (guarded by `'serviceWorker' in navigator`).

## Build & Embedded Assets

**Files:**
- `bun-build.ts` — copy `sw.js` to `dist/`
- `server/embedded-assets.ts` — embed `manifest.json`, `icon.svg`, and `sw.js`

**Steps:**
1. In `bun-build.ts`'s `copyAssets()`, add a line to copy `client/sw.js` to `dist/sw.js` (read as text, write to dist — same pattern as `manifest.json`).
2. In `server/embedded-assets.ts`, add three file imports with `{ type: "file" }`: `manifest.json`, `icon.svg`, and `sw.js` from `../dist/`.
3. Add the corresponding entries to the `assets` map: `"/manifest.json"`, `"/icon.svg"`, `"/sw.js"`.
4. Add content-type entries to `CONTENT_TYPES`: `".json": "application/json"`, `".svg": "image/svg+xml"`.
