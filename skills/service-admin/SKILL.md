---
name: svc
description: >
  Manage development services via process-compose. Start, stop, restart processes, check
  status, and tail logs. Use when the user asks to restart services, check service status,
  view process logs, or manage running processes. Also used by the orchestrator to restart
  services after all waves complete. Triggers on: "restart services", "restart the server",
  "check service status", "show me the logs", "/svc", "/svc restart", or when another skill
  needs to bounce services after code changes.
---

# Service Admin

Manage development services running under process-compose.

## Configuration

The project's CLAUDE.md may define a `service-admin` section specifying which services to
restart by default. If not specified, restart **all** services.

Example CLAUDE.md snippet:
```markdown
## Service Admin
restart: server
```

Check CLAUDE.md for this section before defaulting to all services.

## Commands

All commands use the `process-compose process` subcommand, which communicates with the
running process-compose instance over its default socket.

### List / Status

```bash
process-compose process list -o json   # all processes, JSON output
process-compose process get <name>     # single process state
```

### Start / Stop / Restart

```bash
process-compose process start <name>
process-compose process stop <name>
process-compose process restart <name>
```

To act on multiple processes, run one command per process sequentially.

To restart all services, first `process-compose process list -o json` to discover names,
then restart each.

### Logs

```bash
process-compose process logs <name> -n 50        # last 50 lines
process-compose process logs <name> -f            # follow (stream)
process-compose process logs proc1,proc2 -n 20   # multiple processes
```

## Workflow

### Standalone Use

1. Parse the user request to determine the operation (start/stop/restart/status/logs) and target process(es).
2. If no target specified, check CLAUDE.md for a `service-admin` `restart:` default. If none, list all processes and act on all of them.
3. Execute the command(s).
4. Report the result — for status, show the process state; for restart, confirm the process restarted; for logs, show the output.

### Called by the Orchestrator

The orchestrator calls this skill's restart workflow directly (not via agent) after all waves complete. The orchestrator should:

1. Check CLAUDE.md for a `service-admin` `restart:` setting to determine which services to restart.
2. If specified, restart only those services. If not, list all processes and restart each.
3. Report restart results in the final summary.

## Error Handling

- If process-compose is not running (socket not found), report that to the user — don't retry.
- If a process fails to restart, show the error and suggest checking logs with `process-compose process logs <name> -n 50`.
