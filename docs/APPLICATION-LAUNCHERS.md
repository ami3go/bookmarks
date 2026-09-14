# Applications launchers

Cockpit Bookmarks can launch both terminal applications and browser-facing applications on demand. Launcher cards are grouped under **Applications**.

## Terminal applications

MC, btop, Fish, and other TUI applications continue to use the terminal-launcher engine (GoTTY or ttyd). Existing launcher bookmarks remain compatible. Their saved group is migrated to `Applications` so terminal tools and browser applications appear together.

## Web applications

A web application launcher starts a structured command as the logged-in Cockpit user through a transient `systemd-run --user` service. No `sh -c` command string is generated: the command and every argument remain separate argv entries.

When the application prints a browser URL, Bookmarks reads the transient service journal, extracts the URL using the configured regular expression, and redirects the tab that was opened by the original card click. An optional live-URL command can recover the current URL when an already-running application is reused.

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

The token is used only for the browser navigation and is not persisted in the bookmark configuration.

## Ports

Terminal launchers automatically use the dedicated `47200-47299` pool. Browser-facing application launchers automatically use `47300-47399`. Port selection checks the saved launcher configuration and currently listening host TCP sockets. Custom unprivileged ports remain supported.

## Lifecycle

Application launchers:

1. open a blank browser tab synchronously with the user's click;
2. reuse the launcher when its transient unit is already running and a live URL can be recovered;
3. otherwise start a per-user transient systemd service;
4. wait for a URL from the live-URL command or service journal;
5. redirect the blank tab to that URL;
6. stop automatically at the configured `RuntimeMaxSec` limit.

The Applications manager also provides explicit **Stop** and **Delete** actions.

## Security

Launchers run as the logged-in Cockpit user and do not request root privileges. Network-facing applications are still sensitive:

- a `0.0.0.0`/`::` bind makes the application reachable on host interfaces allowed by the firewall;
- plain HTTP is not encrypted;
- use application authentication, a trusted LAN/VPN, firewall policy, or an authenticated TLS reverse proxy as appropriate;
- tokenized URLs should be treated as credentials even though Bookmarks does not persist them.

Agent of Empires uses token authentication by default. Its own security rules and allowed-host/origin checks still apply.
