# Bug: PWA Not Installable — Analysis

The app needs a service worker with a fetch handler, correctly-sized icon entries in the manifest, and the PWA assets must be included in the compiled binary's embedded assets.

## Decisions

- **Fix strategy**: Three changes are needed:
  1. **Manifest icon sizes**: Add explicit `192x192` and `512x512` entries to the manifest's `icons` array, all pointing to the same `icon.svg` (SVG scales to any size; the `sizes` field just tells Chrome what's available). Keep the existing `"any"` entry as well.
  2. **Service worker**: Create a minimal `sw.js` that registers a fetch handler (passthrough/network-only is fine — Conclave is a real-time app and doesn't need offline caching). Register it from `index.html` or `index.tsx` with `navigator.serviceWorker.register('/sw.js')`.
  3. **Embedded assets**: Add `manifest.json`, `icon.svg`, and `sw.js` to `server/embedded-assets.ts` so they're available in compiled binary mode. Add corresponding content-type entries (`.json` → `application/json`, `.svg` → `image/svg+xml`).
- **Service worker scope**: The SW should be minimal — a network-only fetch handler. Conclave's real-time WebSocket architecture means offline caching would be counterproductive. The SW exists solely to satisfy Chrome's installability check.
- **Build pipeline**: `bun-build.ts` already copies `manifest.json` and `icon.svg` to `dist/`. It will also need to copy `sw.js`. The SW should be a plain JS file (not bundled through Bun's build), since service workers must be served as standalone scripts.
