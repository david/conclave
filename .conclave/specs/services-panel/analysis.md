# Services Panel

A read-only panel in the workspace sidebar showing the status of process-compose services. The server polls the process-compose REST API and relays status as domain events over WebSocket, consistent with the existing event-sourced architecture. A convention-based startup hook allows the project to define what services to launch.

## Decisions

- **Polling architecture**: Server-side relay as domain events (Option B from research). The server polls `GET /processes` on process-compose and emits `ServiceStatusUpdated` events over WebSocket. Client stays WS-only.
- **Poll interval**: 5 seconds.
- **Display**: Minimal — each service row shows name, status indicator, and uptime.
- **Read-only**: No start/stop/restart actions. May be added later.
- **Section order**: Services is the first accordion section, before Specs, Tasks, and Files.
- **Unreachable state**: Panel shows "unavailable" when process-compose isn't responding. Recovers automatically.
- **Startup hook**: Convention-based at `.conclave/hooks/start`. Fire-and-forget — server spawns it and continues startup.
- **Process-compose API**: `GET http://localhost:8080/processes` returns `{ data: ProcessState[] }`. No authentication configured.

## Use Cases

### UC-1: Poll process-compose for service status (High)
- **Actor:** System
- **Summary:** Server polls the process-compose API every 5 seconds and emits a domain event with current service states.
- **Given:** Conclave server is running
- **When:** 5-second poll interval elapses
- **Then:**
  - Server fetches GET /processes from process-compose on port 8080
  - Server emits a ServiceStatusUpdated event containing the process list (name, status, uptime per process)
  - Event is broadcast to all connected WebSocket clients

### UC-2: Display services panel in sidebar (High, depends on UC-1)
- **Actor:** End User
- **Summary:** User sees a Services section in the workspace sidebar showing each process-compose service with its status and uptime.
- **Given:** User has an active WebSocket connection; at least one ServiceStatusUpdated event has been received
- **When:** ServiceStatusUpdated event arrives
- **Then:**
  - Services section appears as the first accordion section in the sidebar (before Specs)
  - Each service is shown as a row with: name, status indicator, and uptime
  - Collapsed summary shows count and aggregate status (e.g. "2 running")

### UC-3: Handle process-compose unavailable (High, depends on UC-1)
- **Actor:** System
- **Summary:** When process-compose is unreachable, the server emits a status event indicating unavailability and the panel reflects this.
- **Given:** Conclave server is running; process-compose is not responding on port 8080
- **When:** Poll interval elapses and the fetch to process-compose fails
- **Then:**
  - Server emits a ServiceStatusUpdated event with an unavailable flag
  - Services panel shows an "unavailable" state instead of process rows
  - Polling continues — panel recovers automatically when process-compose comes back

### UC-4: Run start hook on server startup (High)
- **Actor:** System
- **Summary:** On startup, the server checks for .conclave/hooks/start and runs it fire-and-forget if present.
- **Given:** Conclave server is starting up
- **When:** Server initialization begins
- **Then:**
  - Server checks if .conclave/hooks/start exists and is executable
  - If present, spawns the hook as a child process (fire-and-forget — does not wait for completion)
  - Server continues startup regardless of hook execution status
  - If the file does not exist, startup proceeds normally with no error

### UC-5: Replay service status on WebSocket connect (Medium, depends on UC-1)
- **Actor:** End User
- **Summary:** When a new client connects, it receives the latest service status so the panel is immediately populated.
- **Given:** Server has previously polled process-compose at least once
- **When:** A new WebSocket connection is established
- **Then:**
  - The most recent ServiceStatusUpdated event is included in the event replay
  - Client renders the services panel immediately without waiting for the next poll cycle

### UC-6: Reflect status transitions visually (Medium, depends on UC-2)
- **Actor:** End User
- **Summary:** Service rows update their status indicator in real-time as processes start, stop, or restart.
- **Given:** Services panel is visible with at least one service
- **When:** A new ServiceStatusUpdated event arrives with a changed status for a service
- **Then:**
  - The affected service row updates its status indicator (color/icon) to reflect the new status
  - Uptime value updates
  - Collapsed summary updates to reflect the new aggregate

## Event Model

UC-1, UC-3, and UC-5 share a single event flow: the server polls process-compose and emits `ServiceStatusUpdated`. UC-2 and UC-6 are client-side rendering of that same event. UC-4 (startup hook) is a pure side effect with no domain events.

### Slice: service-status-poll (UC-1, UC-3, UC-5)

```conclave:eventmodel
{
  "slice": "service-status-poll",
  "label": "Poll Service Status",
  "command": {
    "name": "ServiceStatusPoller (timer)",
    "new": true,
    "fields": {
      "intervalMs": "number",
      "apiUrl": "string"
    }
  },
  "events": [
    {
      "name": "ServiceStatusUpdated",
      "new": true,
      "fields": {
        "available": "boolean",
        "services": "ServiceProcess[]"
      }
    }
  ],
  "projections": [
    {
      "name": "latestServiceStatusEvent (in-memory var)",
      "new": true,
      "fields": {
        "event": "ServiceStatusUpdated | null"
      }
    }
  ],
  "sideEffects": [
    "Broadcast ServiceStatusUpdated to all connected WS clients",
    "Replay latest event on new WS connect (same pattern as GitStatusUpdated/SpecListUpdated)"
  ]
}
```

### Slice: service-status-display (UC-2, UC-6)

```conclave:eventmodel
{
  "slice": "service-status-display",
  "label": "Display Services Panel",
  "screen": "Workspace Sidebar",
  "events": [
    {
      "name": "ServiceStatusUpdated",
      "new": false,
      "feeds": ["serviceStatusUpdatedSlice"]
    }
  ],
  "projections": [
    {
      "name": "serviceStatusUpdatedSlice",
      "new": true,
      "fields": {
        "services": "ServiceProcess[]",
        "servicesAvailable": "boolean"
      }
    }
  ],
  "sideEffects": [
    "Re-render Services accordion section in Workspace component"
  ]
}
```

### Slice: startup-hook (UC-4)

```conclave:eventmodel
{
  "slice": "startup-hook",
  "label": "Run Start Hook",
  "events": [
    {
      "name": "ConclaveStarted",
      "new": true
    }
  ],
  "sideEffects": [
    "Subscriber checks if .conclave/hooks/start exists and is executable",
    "If present, spawns hook as fire-and-forget child process"
  ]
}
```

### New Types

- **`ServiceProcess`** — `{ name: string; status: string; uptime: string }` — per-process data extracted from the process-compose API response.
- **`ServiceStatusUpdated`** — extends `BaseGlobalEvent` (no `sessionId`, like `GitStatusUpdated` and `SpecListUpdated`). Carries `available: boolean` and `services: ServiceProcess[]`. When `available` is `false`, `services` is empty.
- **`ConclaveStarted`** — extends `BaseGlobalEvent`. No payload. Emitted once during server initialization. A subscriber reacts by running the start hook if present.

### Infrastructure Extended (not new)

- **`server/index.ts`** — WebSocket `open` handler gains a `latestServiceStatusEvent` replay (same pattern as `latestGitStatusEvent` and `latestSpecListEvent`). A `store.subscribe` listener tracks the latest event and broadcasts to all clients. Emits `ConclaveStarted` during startup; a subscriber handles the hook execution.
- **`server/types.ts`** — `GlobalEvent` union gains `ServiceStatusUpdated` and `ConclaveStarted`. `WsEvent` inherits them automatically.
- **`client/types.ts`** — `AppState` gains `services: ServiceProcess[]` and `servicesAvailable: boolean`. `ClientEvent` union gains `ServiceStatusUpdated`.
- **`client/slices/index.ts`** — new `serviceStatusUpdatedSlice` registered.
- **`client/components/workspace.tsx`** — new "Services" accordion section rendered first, before Specs.
