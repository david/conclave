# Tailscale Setup

Add a `conclave tailscale setup` CLI command that provisions TLS certificates via Tailscale and configures the server to use them automatically.

## Scope

- CLI command for cert provisioning
- Server auto-detection of provisioned certs
- Cert expiry checking at server startup
- **Not** in scope: auto-renewal from the server process, Tailscale Funnel, non-Tailscale ACME providers

## Findings

### Tailscale cert provisioning

`tailscale cert <domain>` provisions a Let's Encrypt TLS certificate for the machine's MagicDNS name (e.g., `myhost.tailnet-name.ts.net`). Tailscale handles the DNS-01 ACME challenge automatically.

- **Output**: PEM-format `.crt` (public cert) and `.key` (private key)
- **Custom paths**: `--cert-file` and `--key-file` flags control output location
- **Lifetime**: 90-day Let's Encrypt certs, no auto-renewal
- **Renewal**: Re-running `tailscale cert` renews if past ~60 days. Idempotent otherwise.
- **Permissions**: Requires root/sudo unless `tailscale up --operator=$USER` was configured
- **Domain discovery**: `tailscale status --self --json` → `.Self.DNSName` (strip trailing dot)

### Current Conclave architecture

- **No CLI dispatch**: The compiled binary (`server/compile.ts`) goes straight to server startup. `bun run dev` runs `server/index.ts` directly.
- **Existing TLS support**: `CONCLAVE_TLS_CERT` and `CONCLAVE_TLS_KEY` env vars pass cert/key file paths to `Bun.serve()`. Optional — defaults to HTTP.
- **No XDG paths**: No state or config directory logic exists yet.
- **Binary build**: `bun build --compile server/compile.ts --outfile ./conclave` produces a standalone binary with embedded client assets.

### Bun's argument parser

Bun supports `util.parseArgs` (Node.js compat) for CLI argument parsing. This avoids adding a dependency.

## Leanings

### CLI routing

Add argument parsing to `compile.ts` (the compiled binary entry point) and to a new dev-mode entry point. Use Bun's `util.parseArgs` or simple `process.argv` inspection to route:

- `conclave` (no args) → start server
- `conclave tailscale setup` → provision certs

### File locations

- **Certs**: `$XDG_STATE_HOME/conclave/tls.crt` and `tls.key` (defaulting to `~/.local/state/conclave/`)
- **Config**: `$XDG_CONFIG_HOME/conclave/settings.json` (defaulting to `~/.config/conclave/`)
- Generic cert names (`tls.crt`/`tls.key`) rather than domain-specific — simpler for the server to discover.

### Settings file

`conclave tailscale setup` writes to `~/.config/conclave/settings.json`:

```json
{
  "tailscale": {
    "domain": "myhost.tailnet-name.ts.net",
    "certProvisionedAt": "2026-02-26T..."
  }
}
```

This signals to the server that Tailscale mode is active.

### Server startup behavior (when Tailscale is configured)

The presence of `settings.json` with a `tailscale` section means the user has opted into Tailscale mode. The server treats this as an intent:

1. **Certs valid** → start with HTTPS, print `https://<domain>:9999`
2. **Certs expiring soon** (past 60 of 90 days) → start but warn: "TLS certs expiring soon, run `conclave tailscale setup` to renew"
3. **Certs missing or expired** → refuse to start: "TLS certs expired/missing, run `conclave tailscale setup`"

`CONCLAVE_TLS_CERT`/`CONCLAVE_TLS_KEY` env vars override all of this — they're the manual escape hatch. If set, the server uses them directly and skips the settings.json/XDG path logic entirely.

### sudo handling

`tailscale cert` usually needs root. The setup command will invoke `sudo tailscale cert ...`, letting the system's sudo handle the password prompt. If sudo fails, print a clear message about `--operator` as an alternative.

### Setup command flow

1. Check `tailscale` is on PATH
2. Run `tailscale status --self --json` to get the DNS name (no sudo needed for status)
3. Create `$XDG_STATE_HOME/conclave/` if it doesn't exist
4. Run `sudo tailscale cert --cert-file <path>/tls.crt --key-file <path>/tls.key <domain>`
5. Write/update `$XDG_CONFIG_HOME/conclave/settings.json` with domain and timestamp
6. Print success: "TLS certs provisioned for <domain>. Start conclave and visit https://<domain>:9999"

## Open Questions

- Should `conclave tailscale setup` also configure the port, or is `PORT` env var sufficient?
- Should there be a `conclave tailscale status` command to check cert validity without starting the server?
- For dev mode (`bun run dev`), how should the CLI routing work? A separate entry point, or the same `server/index.ts` with argv checking?
