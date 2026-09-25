# Application launchers

Cockpit Bookmarks can launch terminal applications and browser-facing applications on demand. Launcher cards are grouped under **Applications** and are managed through the same runtime state/actions UI.

## Terminal applications

MC, btop, Fish, and other TUI applications use the terminal-launcher engine (GoTTY or ttyd). Existing launcher bookmarks remain compatible. See `GOTTY-LAUNCHERS.md` for provider, bind, authentication, and terminal security details.

## Web applications

A web application launcher starts a structured command as the logged-in Cockpit user through a transient `systemd-run --user` service. No `sh -c` application command string is generated: the command and every configured argument remain separate argv entries.

Commands are stored as entered. At launch time, executable names without `/` are resolved with `command -v` using the Cockpit user's real host `PATH`; existing absolute paths remain valid.

Each fresh run gets a private output file under `/run/user/<uid>/cockpit-bookmarks/`. Cockpit Bookmarks extracts the browser URL from the **current run's** output using the configured regular expression, so stale URLs from a previous service journal cannot redirect a new session. An optional live-URL command can recover the current URL when an already-running application is reused.

The saved bookmark contains only a deterministic launcher URL such as:

```text
http://{host}:47300/cb-app-<id>/
```

Runtime URLs, including authentication tokens, are not written to the Bookmarks JSON configuration.

### Placeholders

Application arguments and live-URL command arguments support:

- `{host}` — hostname/IP used to access Cockpit
- `{bind}` — configured application bind address
- `{port}` — configured application TCP port

## Agent of Empires preset

The built-in **Agent of Empires** preset is equivalent to:

```text
aoe serve --host 0.0.0.0 --port <port> --allowed-host <cockpit-host>
```

It also configures:

```text
aoe url
```

as the live-URL recovery command. Agent of Empires prints a tokenized dashboard URL. If that URL uses `localhost`, `127.x`, `0.0.0.0`, `::`, or `::1`, Bookmarks replaces only the hostname with the Cockpit browser hostname and preserves the scheme, port, path, query string, and token.

For example:

```text
http://localhost:47300/?token=abc123
```

opened from Cockpit at `192.168.1.20` becomes:

```text
http://192.168.1.20:47300/?token=abc123
```

The token is used only for browser navigation and is not persisted in bookmark configuration.

## Ports

Terminal launchers automatically use the dedicated `47200-47299` pool. Browser-facing application launchers automatically use `47300-47399`. Port selection checks saved launcher configuration and currently listening host TCP sockets. Custom unprivileged ports remain supported.

## Lifecycle

Application launchers:

1. open a blank browser tab synchronously with the user's click;
2. reuse an active launcher when the service is healthy and a current live URL can be recovered;
3. otherwise create a fresh private output file and start a per-user transient systemd service;
4. wait for the browser URL in current-run output or from the live-URL command;
5. redirect the pending tab to that URL;
6. remain active until the application exits, the user stops it, the systemd user manager stops, or a configured positive auto-stop timeout expires.

`Auto-stop = ∞ — No timeout` omits `RuntimeMaxSec`. Positive selector values add the corresponding systemd runtime limit.

Launcher card menus and the **Applications** manager expose Running/Stopped/Failed state plus Stop, Restart, View output, Edit, and confirmed Delete. Delete attempts to stop the user unit first and requires an explicit **Delete anyway** choice if stopping fails.

## Import security

Application launchers are executable configuration. Imported launchers are normalized through the same launcher builders/validators used by the editor. Before an import containing launchers is accepted, the dialog lists commands, bind addresses, write capability where applicable, and timeouts and requires explicit trust confirmation.

## Security

Launchers run as the logged-in Cockpit user and do not request root privileges. Network-facing applications are still sensitive:

- a `0.0.0.0`/`::` bind makes the application reachable on host interfaces allowed by the firewall;
- plain HTTP is not encrypted;
- use application authentication, a trusted LAN/VPN, firewall policy, or an authenticated TLS reverse proxy as appropriate;
- tokenized URLs should be treated as credentials even though Bookmarks does not persist them.

Agent of Empires uses token authentication by default. Its own security rules and allowed-host/origin checks still apply.
