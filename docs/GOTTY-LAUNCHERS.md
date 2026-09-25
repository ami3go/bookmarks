# On-demand terminal launchers: GoTTY and ttyd

Cockpit Bookmarks can define terminal launcher bookmarks that start an application only when the launcher is opened. A launcher uses either **GoTTY** or **ttyd** as its web-terminal server, wrapped in a transient per-user systemd service.

Examples include MC (`mc`), btop (`btop`), Fish (`fish`), or another executable.

## Persisted compatibility

Existing launcher identities remain compatible:

- persisted type: `gotty-launcher`
- URL path: `/cb-gotty-<id>/`
- user-unit prefix: `cockpit-bookmarks-gotty-`
- missing `provider` means GoTTY

New launcher creation lives in **Add app**. Runtime state and actions for both terminal and web-application launchers live in the unified **Applications** manager and card action menus.

A terminal launcher stores data similar to:

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
    "address": "{host}",
    "autoStopMinutes": 0
  }
}
```

`autoStopMinutes: 0` means **No timeout** and omits `RuntimeMaxSec`. Positive timeout values add the corresponding systemd runtime limit.

## Current defaults and security

Current v0.7 terminal presets intentionally retain their existing behavior:

- listen address: `{host}`
- interactive input enabled (`--permit-write` / `--writable`)
- auto-stop: **No timeout**
- plain HTTP unless TLS/authentication is provided separately by the terminal-server deployment

These defaults can expose an interactive shell beyond loopback depending on how Cockpit was reached, routing, and firewall policy. Review the listen address and security controls before starting a terminal launcher. See `SECURITY.md`.

## Executables and PATH

The configured provider binary and application command are stored exactly as entered. At launch time, a name without `/` is resolved with the logged-in user's host `PATH` using `command -v`. Absolute paths saved by older versions remain valid.

This avoids freezing a `whereis` result into configuration and respects normal PATH precedence such as `/usr/local/bin` before `/usr/bin`.

## Provider compatibility

Compatibility probes no longer run automatically for every configured launcher on every page view.

When a user explicitly starts a terminal launcher, Cockpit Bookmarks checks the selected provider executable with `--version` and `--help`. Results are cached for the browser session by provider/binary pair.

The required CLI contracts are:

- **GoTTY 1.2.0+**: `--address`, `--port`, `--permit-write`, `--path`
- **ttyd 1.7.4+**: `--interface`, `--port`, `--writable`, `--base-path`

A custom build with no parseable semantic version can still be accepted if it exposes every required option. A missing/old/incompatible provider stops the explicit launch with an actionable error.

## Ports and bind addresses

New terminal launchers choose the first unused port in **47200–47299**, skipping ports already assigned to launcher bookmarks or already listening on the host.

`{host}` is expanded at start time. IPv6 brackets are removed when an address is passed to a bind option. For ttyd, a hostname bind value is resolved on the host with `getent ahosts`; if resolution fails, launch stops with a message requesting an IP address or `127.0.0.1`.

## Runtime commands

GoTTY launchers use:

```text
gotty --address <address> --port <port> --permit-write \
  --path /cb-gotty-<id> \
  <application> <arg1> <arg2> ...
```

ttyd launchers use:

```text
ttyd --interface <address> --port <port> --writable \
  --base-path /cb-gotty-<id> \
  <application> <arg1> <arg2> ...
```

Arguments are passed as separate argv entries; Cockpit Bookmarks does not concatenate them into a shell command.

If the user unit is active and its port responds, the existing launcher is reused. If another process owns the configured port, launch is refused.

## State, stopping, and output

Launcher cards and the Applications manager show **Running**, **Stopped**, or **Failed** state from the user's systemd manager. Stop and Restart are available outside Edit mode because the user who started the per-user unit should also be able to control it.

Launcher output is captured per run in a private file below `/run/user/<uid>/cockpit-bookmarks/`. **View output** reads a bounded tail of that file. A terminal start that fails readiness includes the final output lines in its error when available.

Deleting a launcher asks for confirmation and tries to stop the unit first. If stopping fails, the error is shown and the UI offers an explicit **Delete anyway** choice instead of silently leaving a unit behind.

## Discovery

**Discover services** recognizes GoTTY and ttyd listeners. When the process PID is visible, a host-side parser reads `/proc/<pid>/cmdline`, reduces it to non-secret facts, and sends only those facts to the browser:

- TLS enabled
- writable/read-only state
- authentication present
- random URL mode (GoTTY)
- base path
- whether unknown options make inference approximate

Credential values and arbitrary process argv never cross the Cockpit spawn boundary. GoTTY random-URL mode is not auto-added because the generated secret path is not reconstructed.

## Requirements

The host needs the configured `gotty` or `ttyd` executable, the launched application, a working systemd user manager, `bash`, `ss`, and the utilities used by readiness/provider checks. Hostname binding for ttyd additionally uses `getent`.
