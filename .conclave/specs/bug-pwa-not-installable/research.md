# Bug: PWA Not Installable

The app has a web app manifest and PWA meta tags, but browsers do not offer the install prompt.

## Symptom

The browser never shows the PWA install option (e.g. Chrome's "Install app" in the address bar or menu). The manifest is linked, served, and contains valid basic fields, yet the app fails Chrome's installability criteria.

## Root Cause

There are two independent defects preventing installation:

### 1. Missing required icon sizes in manifest.json

- **Where:** `client/manifest.json` — `icons` array
- **What:** The manifest declares a single SVG icon with `"sizes": "any"`. Chrome requires at least a **192x192 px** and a **512x512 px** icon to consider the app installable. While `"sizes": "any"` is valid SVG semantics, Chrome's installability checker does not treat it as satisfying the 192px/512px requirement.
- **Why:** The manifest was written with the assumption that a scalable SVG icon with `"sizes": "any"` would satisfy all size requirements. Chrome's PWA install criteria explicitly check for `192x192` and `512x512` entries.

### 2. No service worker registered

- **Where:** `client/index.html` and `client/index.tsx` — no service worker registration exists anywhere in the client code
- **What:** There is no service worker file (`sw.js` or similar) and no call to `navigator.serviceWorker.register()` anywhere in the codebase. Chrome requires a registered service worker with a fetch handler for the app to be installable.
- **Why:** The PWA setup was partially implemented (manifest, meta tags, icon) but the service worker — a core installability requirement — was never created or registered.

### Secondary issue: Compiled binary missing manifest and icon

- **Where:** `server/embedded-assets.ts` — assets map
- **What:** The embedded assets module only includes `index.html`, `index.js`, and `style.css`. It does not embed `manifest.json` or `icon.svg`. In compiled binary mode, requests for `/manifest.json` and `/icon.svg` return 404, making PWA installation impossible even if the above issues were fixed.
- **Why:** When the embedded assets were set up, only the core rendering assets were included. The PWA assets were overlooked.

## Missing Test Coverage

- **Test 1:** "manifest.json contains 192x192 and 512x512 icon entries" — a static validation test on the manifest file would have caught the missing size declarations.
- **Test 2:** "service worker file exists and index.html or index.tsx registers it" — a test checking for service worker registration would have flagged the missing SW.
- **Test 3:** "embedded-assets.ts includes manifest.json and icon.svg" — a test verifying the embedded assets map covers all files in dist/ would have caught the missing PWA assets in compiled mode.
