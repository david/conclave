# Conclave

A web-based chat interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) via the [Agent Client Protocol (ACP)](https://github.com/anthropics/agent-client-protocol). Two-pane layout with a workspace on the left and chat on the right, backed by an event-sourced server that streams all state changes over WebSocket.

## Quick start

Download the latest release from the [releases page](https://github.com/david/conclave/releases), unzip, and run:

```bash
./conclave
```

The server starts on `http://localhost:9999`. Set `PORT` to change it, and `CONCLAVE_CWD` to set the working directory for Claude Code (defaults to the current directory).

### HTTPS / TLS

Conclave is installable as a PWA, but browsers require HTTPS (or `localhost`) to register the service worker. To serve over HTTPS, set `CONCLAVE_TLS_CERT` and `CONCLAVE_TLS_KEY` to the paths of your certificate and key files:

```bash
CONCLAVE_TLS_CERT=/path/to/cert.pem CONCLAVE_TLS_KEY=/path/to/key.pem ./conclave
```

If you use [Tailscale](https://tailscale.com), you can generate a free TLS certificate for your machine's hostname:

```bash
tailscale cert your-hostname.tail12345.ts.net
CONCLAVE_TLS_CERT=your-hostname.tail12345.ts.net.crt \
CONCLAVE_TLS_KEY=your-hostname.tail12345.ts.net.key \
./conclave
```

For local development, [mkcert](https://github.com/FiloSottile/mkcert) is a good option for generating locally-trusted certificates.

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run build        # Bundle client to dist/
bun run dev          # Start the server on port 9999
```

Or use [process-compose](https://f1bonacc1.github.io/process-compose/) to run both the build watcher and server together:

```bash
process-compose up
```

### Commands

```bash
bun test             # Run all tests
bun test server/     # Server tests only
bun test client/     # Client tests only
bun run check        # TypeScript type checking
```

## Architecture

Conclave uses event sourcing with separated write and read models. The server spawns `claude-code-acp` as a subprocess, translates ACP session updates into domain events, and streams them to connected browsers over WebSocket.

```
Browser ─── WebSocket ──→ Server (command handlers)
                              │
                              ▼
                          EventStore (append-only log)
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Projections          WS relay to clients
              (read models)
```

Multi-session support: the server discovers existing ACP sessions on startup, creates a fresh one, and supports switching and loading on demand.

## License

[MIT](LICENSE)
