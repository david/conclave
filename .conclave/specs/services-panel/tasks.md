# Services Panel — Tasks

Four tasks across three waves. Types are foundational (wave 0). The start hook and client display run in parallel (wave 1) since they touch disjoint file sets. The server poller + index.ts integration runs last (wave 2) because it shares `server/index.ts` with the start hook task.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Add shared types",
    "ucs": [],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["server/types.ts", "client/types.ts"]
    },
    "description": "Add ServiceProcess type and ServiceStatusUpdated event to both server and client type systems. Update the GlobalEvent union."
  },
  {
    "id": "T-1",
    "name": "Start hook runner",
    "ucs": ["UC-4"],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": ["server/start-hook.ts", "server/start-hook.test.ts"],
      "modify": ["server/index.ts"]
    },
    "description": "Create the start hook module and integrate it into server startup. Checks for .conclave/hooks/start and spawns it fire-and-forget."
  },
  {
    "id": "T-2",
    "name": "Client services display",
    "ucs": ["UC-2", "UC-6"],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": ["client/slices/service-status-updated.ts", "client/slices/service-status-updated.test.ts"],
      "modify": ["client/slices/index.ts", "client/components/workspace.tsx", "client/components/icons.tsx", "client/index.tsx", "client/style.css"]
    },
    "description": "Add the client slice, Services accordion section in workspace sidebar, status icons, and CSS. Services section renders first (before Specs) with status dots and uptime per row."
  },
  {
    "id": "T-3",
    "name": "Service status poller and server integration",
    "ucs": ["UC-1", "UC-3", "UC-5"],
    "depends": ["T-0", "T-1"],
    "wave": 2,
    "kind": "code",
    "files": {
      "create": ["server/service-status-poller.ts", "server/service-status-poller.test.ts"],
      "modify": ["server/index.ts"]
    },
    "description": "Create the process-compose poller module and integrate into server/index.ts. Polls GET localhost:8080/processes every 5s, emits ServiceStatusUpdated global events, handles unavailability, and replays latest event on WS connect."
  }
]
```

## Wave 0

### T-0: Add shared types
- **UCs**: (prerequisite for all)
- **Files**: modify `server/types.ts`, modify `client/types.ts`
- **Summary**: Add the `ServiceProcess` and `ServiceStatusUpdated` types that all subsequent tasks depend on.
- **Steps**:
  1. In `server/types.ts`, add `ServiceProcess` type: `{ name: string; status: string; uptime: string }`.
  2. Add `ServiceStatusUpdated` event type: `BaseGlobalEvent & { type: "ServiceStatusUpdated"; available: boolean; services: ServiceProcess[] }`.
  3. Add `ServiceStatusUpdated` to the `GlobalEvent` union (alongside `SpecListUpdated | GitStatusUpdated`).
  4. In `client/types.ts`, add `ServiceProcess` type (same shape).
  5. Add `services: ServiceProcess[]` and `servicesAvailable: boolean` to `AppState`.
  6. Set initial values in `initialState`: `services: []`, `servicesAvailable: true`.
- **Tests**: Type-check only (`bun run check`). No behavioral tests needed for type definitions.

## Wave 1 (parallel)

### T-1: Start hook runner
- **UCs**: UC-4
- **Depends on**: T-0
- **Files**: create `server/start-hook.ts`, create `server/start-hook.test.ts`, modify `server/index.ts`
- **Summary**: Create the start hook module and wire it into server startup. The hook is a convention-based executable at `.conclave/hooks/start` that runs fire-and-forget.
- **Steps**:
  1. Create `server/start-hook.ts` exporting `runStartHook(cwd: string): void`.
  2. The function checks if `.conclave/hooks/start` exists using `Bun.file(join(cwd, ".conclave/hooks/start")).exists()`.
  3. If present, spawns it with `Bun.spawn` fire-and-forget (no `await` on `.exited`). Set `cwd` to the project root. Log to console on spawn. Attach stderr handler that logs errors but doesn't throw.
  4. If the file does not exist, return silently.
  5. In `server/index.ts`, import `runStartHook` and call `runStartHook(CWD)` at the top of the `bridge.start().then(...)` callback, before session discovery.
- **Tests** (`server/start-hook.test.ts`):
  - `runStartHook` with a non-existent hook path does not throw.
  - `runStartHook` with an existing executable script spawns a process. Verify using a temp file written by the hook script.

### T-2: Client services display
- **UCs**: UC-2, UC-6
- **Depends on**: T-0
- **Files**: create `client/slices/service-status-updated.ts`, create `client/slices/service-status-updated.test.ts`, modify `client/slices/index.ts`, modify `client/components/workspace.tsx`, modify `client/components/icons.tsx`, modify `client/index.tsx`, modify `client/style.css`
- **Summary**: Build the full client-side rendering pipeline for service status — from event handling (slice) through to the visual Services accordion section in the workspace sidebar.
- **Steps**:
  1. Create `client/slices/service-status-updated.ts` using `createSlice("ServiceStatusUpdated", ...)`. Handler replaces `services` with `event.services` and `servicesAvailable` with `event.available`.
  2. In `client/slices/index.ts`, import `serviceStatusUpdatedSlice` and add it to the `slices` array.
  3. In `client/components/icons.tsx`, add a `ServiceStatusIcon` component that maps process-compose status strings to colored dots. Key statuses: `"Running"` (green), `"Completed"` / `"Skipped"` (gray), `"Launching"` / `"Restarting"` (amber), other/error (red).
  4. In `client/components/workspace.tsx`:
     - Add `"services"` to the `SectionId` union type.
     - Accept `services: ServiceProcess[]` and `servicesAvailable: boolean` as new props on `WorkspaceProps`.
     - Add a `servicesSummary` function: when unavailable, return `"unavailable"`; otherwise return `"{n} running"` where n is the count of services with status `"Running"`.
     - Add a `ServiceRow` component rendering: `ServiceStatusIcon`, service name, and uptime string.
     - Render the "Services" accordion section **first** (before Specs), only when `services.length > 0 || !servicesAvailable`.
     - When `servicesAvailable` is false, show a single "unavailable" message row instead of service rows.
     - Update the auto-expand logic to prioritize the services section when it's the first to receive content.
     - Update `hasContent` to include `hasServices`.
  5. In `client/index.tsx`, pass `services={state.services}` and `servicesAvailable={state.servicesAvailable}` to `<Workspace>`. Add `state.services.length > 0` to the `workspaceVisible` condition.
  6. In `client/style.css`, add `.service-row` styling (same pattern as `.file-change`), `.service-status-dot` with color variants (Running=green, Launching=amber, error=red, inactive=gray), and `.workspace__services-section`.
- **Tests** (`client/slices/service-status-updated.test.ts`):
  - `ServiceStatusUpdated` with `available: true` replaces `services` array and sets `servicesAvailable: true`.
  - `ServiceStatusUpdated` with `available: false` clears `services` to `[]` and sets `servicesAvailable: false`.
  - Event with different type is ignored (state unchanged).

## Wave 2 (after wave 1)

### T-3: Service status poller and server integration
- **UCs**: UC-1, UC-3, UC-5
- **Depends on**: T-0, T-1
- **Files**: create `server/service-status-poller.ts`, create `server/service-status-poller.test.ts`, modify `server/index.ts`
- **Summary**: Create the process-compose poller and integrate it into the server. This is the final server-side piece — it depends on T-1 because both modify `server/index.ts`.
- **Steps**:
  1. Create `server/service-status-poller.ts` following the same structure as `git-status-poller.ts`.
  2. Export `parseProcesses(data: unknown): ServiceProcess[]` that extracts `{ name, status, uptime }` from `{ data: ProcessState[] }`. Handle missing/malformed data by returning `[]`.
  3. Export `startServiceStatusPoller(options)` with signature:
     ```ts
     type ServiceStatusPollerOptions = {
       apiUrl: string;
       intervalMs: number;
       onUpdate: (available: boolean, services: ServiceProcess[]) => void;
     };
     ```
  4. The `tick` function calls `fetch(apiUrl)`, parses JSON through `parseProcesses`, calls `onUpdate(true, services)`. On failure, calls `onUpdate(false, [])`.
  5. Always call `onUpdate` on every tick (no dedup — unlike git poller).
  6. Return `{ stop: () => void }` that clears the interval.
  7. In `server/index.ts`:
     - Import `startServiceStatusPoller`.
     - Add `latestServiceStatusEvent` variable (same pattern as `latestGitStatusEvent`).
     - Add `store.subscribe` listener for `ServiceStatusUpdated` → track in `latestServiceStatusEvent` + broadcast to all WS clients.
     - In `bridge.start().then(...)`, after git poller start, call `startServiceStatusPoller(...)` with `onUpdate` that calls `store.appendGlobal(...)`.
     - Add `stopServicePoller` to `shutdown()` cleanup.
     - In `websocket.open`, after sending `latestGitStatusEvent`, send `latestServiceStatusEvent` if available.
- **Tests** (`server/service-status-poller.test.ts`):
  - `parseProcesses` with valid `{ data: [...] }` returns correctly shaped `ServiceProcess[]`.
  - `parseProcesses` with empty data returns `[]`.
  - `parseProcesses` with malformed input (null, missing `data` key, non-array) returns `[]`.
