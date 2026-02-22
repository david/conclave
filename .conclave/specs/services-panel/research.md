# Services Panel

Adding a panel to the workspace sidebar that shows the status of process-compose services, polled from its REST API.

## Findings

### Process-Compose REST API

Process-compose runs an HTTP API server on **port 8080** by default (configurable via `-p` flag or `PC_PORT_NUM` env var). The full OpenAPI/Swagger spec is at `http://localhost:8080/swagger/doc.json`.

**Key endpoint for this feature — `GET /processes`:**

Returns `types.ProcessesState`:
```json
{
  "data": [
    {
      "name": "build",
      "namespace": "default",
      "status": "Running",
      "system_time": "36m",
      "age": 2186595118516,
      "is_ready": "-",
      "has_ready_probe": false,
      "restarts": 0,
      "exit_code": 0,
      "pid": 6350,
      "is_elevated": false,
      "password_provided": false,
      "mem": 9900032,
      "cpu": 0,
      "is_running": true
    }
  ]
}
```

**Useful fields for the panel:**
- `name` — process name (e.g. "build", "server")
- `status` — string status ("Running", "Stopped", "Completed", etc.)
- `is_running` — boolean
- `system_time` — human-readable uptime ("36m")
- `restarts` — restart count
- `exit_code` — last exit code
- `pid` — OS process ID
- `mem` — memory in bytes
- `cpu` — CPU percentage (number)

**Other relevant endpoints:**
- `GET /process/{name}` — single process state
- `POST /process/restart/{name}` — restart a process
- `POST /process/start/{name}` — start a process
- `PATCH /process/stop/{name}` — stop a process
- `GET /process/logs/{name}/{endOffset}/{limit}` — get log lines
- `GET /process/logs/ws?name=X&offset=0&follow=true` — WebSocket log stream
- `GET /live` — liveness check (useful as connectivity test)

**Authentication:** Optional, via `PC_API_TOKEN` env var + `X-PC-Token-Key` header. Not configured in our setup.

### Current Workspace Sidebar

The sidebar (`client/components/workspace.tsx`) has three collapsible accordion sections:
1. **Specs** — project spec entries grouped by epic
2. **Tasks** — plan entries with status (pending/in_progress/completed)
3. **Files** — git file changes grouped into staged/unstaged/untracked

Key patterns:
- Accordion behavior: one section expanded at a time, controlled by `expandedSection` state
- Each section has a header (chevron + label + collapsed summary) and scrollable content
- Auto-expand logic: first section with content expands on mount; tasks get priority if they arrive late
- Data flows in via props from AppState (`entries`, `gitFiles`, `specs`)
- BEM-style CSS: `.workspace__section-header`, `.workspace__section--expanded`, `.workspace__section-scroll`
- Status icons use `data-status` attributes mapped to CSS color variables

### Architecture Questions

**Where to poll:**
- **Option A: Client-side polling.** Each browser tab fetches `http://localhost:8080/processes` directly on an interval. Simple. No server changes. But the process-compose port (8080) must be accessible from the browser — could be a CORS issue since the app runs on port 3000.
- **Option B: Server-side proxy + relay via WebSocket.** The Conclave server polls process-compose and relays status as domain events over the existing WebSocket. Consistent with the event-sourced architecture. Avoids CORS. The server already manages the WS connection.
- **Option C: Server-side proxy endpoint.** Add a simple `GET /api/services` proxy on the Conclave server that fetches from process-compose and returns the result. Client polls this endpoint. Simpler than B, still avoids CORS.

**Polling vs WebSocket stream:**
Process-compose has a WebSocket endpoint (`/process/logs/ws`) but only for log streaming, not for status changes. So polling `GET /processes` is the intended approach for status.

### Startup Hooks

Rather than hardcoding process-compose startup in the server, use a convention-based hook:

- If `.conclave/hooks/start` exists and is executable, the server runs it on startup
- **Fire-and-forget** — server kicks it off and continues starting up. The services panel shows "unavailable" until process-compose responds, which naturally handles the timing gap.
- No config format, no registration — just a file convention
- Opens the door to more hooks later (`stop`, `session-created`, etc.) by the same pattern

This keeps the "what to start" policy in the project, not in the code. The user can put whatever they want in the hook — start process-compose, seed a database, run migrations, etc.

## Decisions

- **Polling**: Option B — server-side relay as domain events over WebSocket
- **Display**: Minimal — name, status indicator, uptime
- **Read-only**: No start/stop/restart actions initially
- **Poll interval**: 5 seconds
- **Startup**: Convention-based hook at `.conclave/hooks/start` (fire-and-forget)
- **Section order**: Services first, then Specs, Tasks, Files
- **Unreachable state**: Panel shows "unavailable" when process-compose isn't responding
