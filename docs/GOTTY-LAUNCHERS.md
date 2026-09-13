# On-demand GoTTY launchers

Cockpit Bookmarks can define launcher bookmarks that start a terminal application only when the bookmark is clicked.

Examples:

- **MC** → `mc`
- **btop** → `btop`
- **Fish** → `fish`

The launcher opens a new browser tab immediately, starts a transient GoTTY service through the logged-in user's systemd user manager, waits for the configured TCP port to become ready, and then redirects the tab to GoTTY.

## Creating a launcher

Open **GoTTY launchers** and choose **New launcher**, **New MC**, **New btop**, or **New Fish**.

Launcher parameters:

- **Bookmark name** — card label, for example `MC`
- **Application command** — executable to run inside GoTTY, for example `mc`, `btop`, or `fish`
- **Arguments** — optional, one argv entry per line; no shell interpolation is performed
- **TCP port** — unprivileged port used by this launcher
- **Auto-stop minutes** — maximum lifetime of the transient GoTTY systemd service
- **Listen address** — where GoTTY binds

**Application command**, **Arguments**, and **Listen address** accept the `{host}` placeholder, resolved to the Cockpit host name or IP address the browser is currently using — the same substitution used in regular bookmark URLs. It is expanded just before the launcher starts, so the stored configuration keeps the placeholder rather than a fixed address.
- **GoTTY executable** — normally `gotty`, or an absolute path when required
- **Group / icon / accent** — normal dashboard presentation

For new launchers, Bookmarks automatically chooses the first unused port in **47200–47299**. It skips ports already assigned to another GoTTY launcher and ports that are currently listening on the host. This range is intentionally kept away from common development web ports such as 3000, 8000, 8080, and 9000. You can still enter a custom unprivileged port manually.

If all ports in the automatic range are occupied, Bookmarks asks you to choose a custom port instead of automatically moving into another range.

A launcher is stored as a regular bookmark with additional metadata similar to:

```json
{
  "id": "example-id",
  "type": "gotty-launcher",
  "integration": "gotty",
  "name": "MC",
  "url": "http://{host}:47200/cb-gotty-example-id/",
  "gottyLauncher": {
    "binary": "gotty",
    "command": "mc",
    "args": [],
    "port": 47200,
    "address": "127.0.0.1",
    "autoStopMinutes": 30
  }
}
```

## Runtime model

Clicking the launcher runs a command equivalent in structure to:

```text
systemd-run --user \
  --unit=cockpit-bookmarks-gotty-<id>.service \
  --collect \
  --service-type=exec \
  --property=RuntimeMaxSec=<seconds> \
  --property=KillMode=control-group \
  -- \
  gotty --address <address> --port <port> --permit-write \
  --path /cb-gotty-<id> \
  <application> <arg1> <arg2> ...
```

The application and arguments are passed directly as argv values. Bookmarks does not concatenate them into `sh -c` or another shell command.

If the launcher's user service is already active and the configured port responds, it is reused instead of starting another instance.

If another process already owns the configured port, launch is refused rather than opening the wrong service.

## Security

Launcher profiles deliberately run as the **logged-in Cockpit user** through `systemd-run --user`. Bookmarks does not request root privileges for a launcher.

GoTTY is started with `--permit-write` because applications such as MC, btop, and fish need keyboard input. A writable web terminal is sensitive.

The default listen address is `127.0.0.1`. This is the safest default, but a browser on another computer normally cannot reach the host's loopback interface. For remote access you may choose `0.0.0.0`, `::`, or a specific reachable interface address, but only do this on a trusted LAN/VPN or with appropriate firewall/proxy controls.

On-demand launchers do not store GoTTY credentials and currently start plain HTTP GoTTY. For Internet-facing terminal access, prefer an authenticated/TLS reverse proxy or a separately managed hardened GoTTY deployment instead of an on-demand launcher.

## Requirements

The host needs:

- `gotty` available to the logged-in user
- the configured application (`mc`, `btop`, `fish`, etc.)
- a working systemd user manager (`systemctl --user` / `systemd-run --user`)
- `bash`, `timeout`, and `ss` for readiness and port checks

## QR and copied URLs

A launcher uses a valid GoTTY URL, so Copy URL and QR code continue to represent the real terminal address. They do **not** start the launcher by themselves. Start the launcher from Cockpit Bookmarks first if the service is currently stopped.
