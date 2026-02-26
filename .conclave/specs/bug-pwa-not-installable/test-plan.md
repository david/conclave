# PWA Not Installable — Test Plan

All three root causes (missing icon sizes, missing service worker, missing embedded assets) lack any existing test coverage. This plan adds 6 unit tests across 4 new test files: static validation of `manifest.json`, structural validation of `sw.js` and its registration in `index.html`, build pipeline coverage for `sw.js` copying, and embedded asset completeness. All tests are unit-level since each verifies a single file's content or a single function's output in isolation.

## Existing Coverage

No existing tests cover any of the files or behaviors affected by this spec.

## Manifest Icon Sizes

### manifest.json — contains 192x192 icon entry

- **Level:** unit
- **Status:** new
- **File:** `client/manifest.test.ts`
- **Covers:** Manifest Icon Sizes step 1 — 192x192 entry exists
- **Scenario:**
  - **Arrange:** Read and parse `client/manifest.json`
  - **Act:** Filter the `icons` array for an entry with `"sizes": "192x192"`
  - **Assert:** Exactly one matching entry exists with `src` of `"/icon.svg"` and `type` of `"image/svg+xml"`

### manifest.json — contains 512x512 icon entry

- **Level:** unit
- **Status:** new
- **File:** `client/manifest.test.ts`
- **Covers:** Manifest Icon Sizes step 1 — 512x512 entry exists
- **Scenario:**
  - **Arrange:** Read and parse `client/manifest.json`
  - **Act:** Filter the `icons` array for an entry with `"sizes": "512x512"`
  - **Assert:** Exactly one matching entry exists with `src` of `"/icon.svg"` and `type` of `"image/svg+xml"`

## Service Worker

### sw.js — exists and contains a fetch event listener

- **Level:** unit
- **Status:** new
- **File:** `client/sw.test.ts`
- **Covers:** Service Worker step 1 — sw.js file exists with fetch handler
- **Scenario:**
  - **Arrange:** Read `client/sw.js` as text
  - **Act:** Check the file content for `addEventListener` with `"fetch"` (or equivalent `self.onfetch`/`addEventListener('fetch'`)
  - **Assert:** The file exists (read doesn't throw) and contains a fetch event listener registration

### index.html — registers the service worker

- **Level:** unit
- **Status:** new
- **File:** `client/sw.test.ts`
- **Covers:** Service Worker step 2 — index.html registers sw.js
- **Scenario:**
  - **Arrange:** Read `client/index.html` as text
  - **Act:** Check for `navigator.serviceWorker.register` referencing `sw.js`
  - **Assert:** The HTML contains a script that calls `navigator.serviceWorker.register` with a path to `sw.js`

## Build & Embedded Assets

### bun-build.ts — copyAssets copies sw.js to dist

- **Level:** unit
- **Status:** new
- **File:** `bun-build.test.ts`
- **Covers:** Build & Embedded Assets step 1 — sw.js included in build output
- **Scenario:**
  - **Arrange:** Read `bun-build.ts` as text
  - **Act:** Check that the `copyAssets` function body references `sw.js`
  - **Assert:** The source contains a read of `client/sw.js` (or `"sw.js"`) and a write to `dist/sw.js`

### embedded-assets.ts — includes manifest.json, icon.svg, and sw.js

- **Level:** unit
- **Status:** new
- **File:** `server/embedded-assets.test.ts`
- **Covers:** Build & Embedded Assets steps 2–4 — all PWA assets embedded with correct content types
- **Scenario:**
  - **Arrange:** Import `serveEmbeddedAsset` from `server/embedded-assets.ts`
  - **Act:** Call `serveEmbeddedAsset("/manifest.json")`, `serveEmbeddedAsset("/icon.svg")`, and `serveEmbeddedAsset("/sw.js")`
  - **Assert:** Each call returns a non-null `Response` with the correct `Content-Type` header (`application/json` for manifest, `image/svg+xml` for icon, `application/javascript` for sw.js)
