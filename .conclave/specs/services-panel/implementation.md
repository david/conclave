# Services Panel — Implementation

The server gains a process-compose poller (modeled after `git-status-poller.ts`) that fetches `GET http://localhost:8080/processes` every 5 seconds and emits `ServiceStatusUpdated` global events. A startup hook runner spawns `.conclave/hooks/start` fire-and-forget during initialization. The client adds a new slice and renders a "Services" accordion section at the top of the workspace sidebar. The latest event is replayed on WS connect so new clients see status immediately.

## New Types

### `server/types.ts`

```ts
export type ServiceProcess = {
  name: string;
  status: string;
  uptime: string;
};

export type ServiceStatusUpdated = BaseGlobalEvent & {
  type: "ServiceStatusUpdated";
  available: boolean;
  services: ServiceProcess[];
};
```

- Add `ServiceStatusUpdated` to the `GlobalEvent` union (alongside `SpecListUpdated | GitStatusUpdated`).
- Add `ServiceProcess` and `ServiceStatusUpdated` as named exports.

### `client/types.ts`

```ts
export type ServiceProcess = {
  name: string;
  status: string;
  uptime: string;
};
```

- Add `services: ServiceProcess[]` and `servicesAvailable: boolean` to `AppState` (default `[]` and `true`).
- `ClientEvent` union already inherits `ServiceStatusUpdated` via `WsEvent` — no manual addition needed.

## UC-4: Run Start Hook on Server Startup

**Files:**
- `server/start-hook.ts` — new file, start hook runner
- `server/start-hook.test.ts` — new file, tests
- `server/index.ts` — call the hook runner during startup

**Steps:**
1. Create `server/start-hook.ts` exporting `runStartHook(cwd: string): void`.
2. The function checks if `.conclave/hooks/start` exists using `Bun.file(...).exists()`.
3. If present, spawns it with `Bun.spawn` fire-and-forget (no `await` on `.exited`). Set `cwd` to the project root. Log to console on spawn. Attach stderr handler that logs errors but doesn't throw.
4. If the file does not exist, return silently.
5. In `server/index.ts`, call `runStartHook(CWD)` at the top of the `bridge.start().then(...)` callback, before session discovery. This ensures services start booting while the ACP bridge discovers sessions.

**Tests:**
- `runStartHook` with a non-existent hook path does not throw.
- (Integration) `runStartHook` with an existing executable script spawns a process. Verify using a temp file written by the hook script.

## UC-1 + UC-3 + UC-5: Poll Service Status, Handle Unavailable, Replay on Connect

These three use cases share the same server-side flow: poll, emit, replay.

**Files:**
- `server/service-status-poller.ts` — new file, process-compose poller
- `server/service-status-poller.test.ts` — new file, tests for response parsing
- `server/index.ts` — integrate poller, track latest event, replay on WS connect

### `server/service-status-poller.ts`

**Steps:**
1. Create `server/service-status-poller.ts` following the same structure as `git-status-poller.ts`.
2. Export a `parseProcesses(data: unknown): ServiceProcess[]` function that extracts `{ name, status, uptime }` from the process-compose API response shape `{ data: ProcessState[] }`. Map each entry to a `ServiceProcess`. Handle missing/malformed data by returning `[]`.
3. Export `startServiceStatusPoller(options)` with the signature:
   ```ts
   type ServiceStatusPollerOptions = {
     apiUrl: string;      // default "http://localhost:8080/processes"
     intervalMs: number;  // default 5000
     onUpdate: (available: boolean, services: ServiceProcess[]) => void;
   };
   ```
4. The `tick` function calls `fetch(apiUrl)`, parses the JSON response through `parseProcesses`, and calls `onUpdate(true, services)`.
5. On fetch failure (network error, non-200 status), call `onUpdate(false, [])`.
6. Unlike the git poller, do NOT deduplicate — always call `onUpdate` so the event lands in the store and is available for replay. The store is append-only and the client simply overwrites its state on each event.
7. Return `{ stop: () => void }` that clears the interval.

### `server/index.ts` — integration

**Steps:**
1. Import `startServiceStatusPoller` and `ServiceProcess` type.
2. Add a `latestServiceStatusEvent` variable (same pattern as `latestGitStatusEvent` and `latestSpecListEvent`).
3. Add a `store.subscribe` listener that tracks `ServiceStatusUpdated` events in `latestServiceStatusEvent` and broadcasts to all connected WS clients.
4. In the `bridge.start().then(...)` callback, after the git poller start, call:
   ```ts
   const servicePoller = startServiceStatusPoller({
     apiUrl: "http://localhost:8080/processes",
     intervalMs: 5000,
     onUpdate: (available, services) => {
       store.appendGlobal({ type: "ServiceStatusUpdated", available, services });
     },
   });
   stopServicePoller = servicePoller.stop;
   ```
5. Add `stopServicePoller` to the `shutdown()` cleanup.
6. In `websocket.open`, after sending `latestGitStatusEvent`, send `latestServiceStatusEvent` if available.

**Tests (`server/service-status-poller.test.ts`):**
- `parseProcesses` with valid `{ data: [...] }` returns correctly shaped `ServiceProcess[]`.
- `parseProcesses` with empty data returns `[]`.
- `parseProcesses` with malformed input (null, missing `data` key, non-array) returns `[]`.

## UC-2 + UC-6: Display Services Panel, Reflect Status Transitions

**Files:**
- `client/slices/service-status-updated.ts` — new file, client slice
- `client/slices/service-status-updated.test.ts` — new file, tests
- `client/slices/index.ts` — register the new slice
- `client/types.ts` — add state fields and type
- `client/components/workspace.tsx` — add Services accordion section
- `client/components/icons.tsx` — add `ServiceStatusIcon` component
- `client/index.tsx` — pass new state to `Workspace`, include in visibility check

### `client/types.ts`

**Steps:**
1. Add `ServiceProcess` type (as defined in New Types above).
2. Add `services: ServiceProcess[]` and `servicesAvailable: boolean` to `AppState`.
3. Set initial values: `services: []`, `servicesAvailable: true`.

### `client/slices/service-status-updated.ts`

**Steps:**
1. Create using `createSlice("ServiceStatusUpdated", ...)`.
2. Handler replaces `services` with `event.services` and `servicesAvailable` with `event.available`.

### `client/slices/index.ts`

**Steps:**
1. Import `serviceStatusUpdatedSlice` from `./service-status-updated.ts`.
2. Add it to the `slices` array.

### `client/components/icons.tsx` (if status icons are defined here)

**Steps:**
1. Add a `ServiceStatusIcon` component that maps process-compose status strings to colored dots/indicators. Key statuses: `"Running"` (green), `"Completed"` / `"Skipped"` (gray), `"Launching"` / `"Restarting"` (amber), other/error (red).

### `client/components/workspace.tsx`

**Steps:**
1. Add `"services"` to the `SectionId` union type.
2. Accept `services: ServiceProcess[]` and `servicesAvailable: boolean` as new props on `WorkspaceProps`.
3. Add a `servicesSummary` function: when unavailable, return `"unavailable"`; otherwise return `"{n} running"` where n is the count of services with status `"Running"`.
4. Add a `ServiceRow` component rendering: `ServiceStatusIcon`, service name, and uptime string.
5. Render the "Services" accordion section **first** (before Specs), only when `services.length > 0 || !servicesAvailable`. The section follows the same expand/collapse pattern as existing sections.
6. When `servicesAvailable` is false, show a single "unavailable" message row instead of service rows.
7. Update the auto-expand logic to prioritize the services section when it's the first to receive content.
8. Update `hasContent` to include `hasServices`.

### `client/index.tsx`

**Steps:**
1. Pass `services={state.services}` and `servicesAvailable={state.servicesAvailable}` to `<Workspace>`.
2. Add `state.services.length > 0` to the `workspaceVisible` condition.

### CSS (`client/style.css`)

**Steps:**
1. Add `.service-row` styling (same pattern as `.file-change` rows — icon + name + metadata).
2. Add `.service-status-dot` with color variants for Running (green), Launching (amber), error (red), inactive (gray).
3. Add `.workspace__services-section` class mirroring the existing section pattern.

**Tests (`client/slices/service-status-updated.test.ts`):**
- `ServiceStatusUpdated` with `available: true` replaces `services` array and sets `servicesAvailable: true`.
- `ServiceStatusUpdated` with `available: false` clears `services` to `[]` and sets `servicesAvailable: false`.
- Event with different type is ignored (state unchanged).
