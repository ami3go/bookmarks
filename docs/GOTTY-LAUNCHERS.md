# On-demand terminal launchers: GoTTY and ttyd

Cockpit Bookmarks can define launcher bookmarks that start a terminal application only when the bookmark is clicked. Each launcher can use either **GoTTY** or **ttyd** as its web-terminal server.

Examples include MC (`mc`), btop (`btop`), Fish (`fish`), or another executable. The launcher opens a new browser tab immediately, starts a transient user service through `systemd-run --user`, waits for the configured TCP port, and then redirects the tab to the terminal.

## Choosing a terminal server

The launcher editor has a **Terminal server** field:

- **GoTTY** — preserves the existing launcher behavior and command line.
- **ttyd** — uses ttyd's `--interface`, `--port`, `--writable`, and `--base-path` options.

Existing saved launchers do not require migration. The historical bookmark type remains `gotty-launcher`, the URL path remains `/cb-gotty-<id>/`, and a launcher without a `provider` field is interpreted as GoTTY. This keeps old bookmarks, copied URLs, and systemd unit identities stable.

A new launcher stores provider metadata inside the existing launcher object, for example:

```json
{
  "id": "example-id",
  "type": "gotty-launcher",
  "integration": "ttyd",
  "name": "MC",
  "url": "http://{host}:47200/cb-gotty-example-id/",
  "gottyLauncher": {
    "provider": "ttyd",
    "binary": "ttyd",
    "command": "mc",
    "args": [],
    "port": 47200,
    "address": "127.0.0.1",
    "autoStopMinutes": 30
  }
}
```

## Version and fork compatibility

Cockpit Bookmarks checks every configured terminal-server executable using both `--version` and `--help`. This is intentionally stricter than trusting the version string alone because old or incompatible forks may report a plausible version while missing command-line options required by the launcher.

The minimum supported versions are:

- **GoTTY 1.2.0 or newer** — the launcher requires `--address`, `--port`, `--permit-write`, and `--path`. Legacy GoTTY releases and forks without `--path` are unsupported.
- **ttyd 1.7.4 or newer** — the launcher requires `--interface`, `--port`, `--writable`, and `--base-path`. Older ttyd builds using the historical `--readonly` behavior are unsupported.

When a configured binary is too old, cannot be executed, or is missing one of the required options, the dashboard displays a danger alert explaining the detected version and the missing compatibility requirement. If a custom build does not expose a parseable semantic version but does provide every required option, Bookmarks treats it as capability-compatible and displays a warning that the exact version could not be verified.

## Launcher parameters

The manager and card editor expose bookmark name, terminal server, terminal-server executable, application command, application arguments, TCP port, listen address, auto-stop time, group, icon, and accent. Application command, arguments, and listen address continue to support the `{host}` placeholder.

New launchers automatically choose the first unused port in **47200–47299**, skipping configured launcher ports and ports already listening on the host. Custom unprivileged ports are still supported.

## Runtime commands

GoTTY launchers use the established form:

```text
gotty --address <address> --port <port> --permit-write \
  --path /cb-gotty-<id> \
  <application> <arg1> <arg2> ...
```

ttyd launchers use the equivalent ttyd form:

```text
ttyd --interface <address> --port <port> --writable \
  --base-path /cb-gotty-<id> \
  <application> <arg1> <arg2> ...
```

Both commands are wrapped by the same transient `systemd-run --user` service with `RuntimeMaxSec` and `KillMode=control-group`. Application arguments are passed as separate argv values; Bookmarks does not construct a shell command.

If the launcher user service is already active and the configured port responds, it is reused. If another process already owns the port, launch is refused instead of opening an unrelated service.

## Service discovery

**Discover services** recognizes both GoTTY and ttyd listeners. When the process PID is visible, Bookmarks inspects command-line options to infer TLS, writable/read-only mode, authentication presence, and base path.

Basic-auth credential values are redacted on the host before process arguments cross the Cockpit spawn boundary. Bookmarks records only that authentication is present; it does not store the credential value.

GoTTY random-URL mode remains deliberately excluded from automatic bookmark creation because the generated secret path cannot be reconstructed safely.

## Security

Launchers run as the **logged-in Cockpit user**, never as root. On-demand launchers enable interactive input (`--permit-write` for GoTTY, `--writable` for ttyd) because terminal applications need keyboard input.

The default listen address is `127.0.0.1`. A browser on another machine normally needs a reachable LAN/VPN address such as `0.0.0.0`, `::`, or a specific interface address. A writable web terminal is sensitive: expose it only on a trusted network or behind suitable firewall/reverse-proxy authentication and TLS controls.

On-demand launchers do not persist terminal-server credentials and currently start plain HTTP unless you run a separately managed hardened deployment.

## Requirements

The host needs either `gotty` or `ttyd` available to the logged-in user, plus the configured terminal application, a working systemd user manager, and `bash`, `timeout`, and `ss` for readiness and port checks.

An absolute path to the terminal-server executable can be configured when it is not present on the systemd user manager's PATH.
