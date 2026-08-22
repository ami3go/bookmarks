# Cockpit Bookmarks

A tiny Cockpit extension that adds a **Bookmarks** page for web services hosted on the same mini PC.

It is intentionally lightweight:

- no Docker
- no daemon or background service
- no database
- no Node.js/Python runtime dependency
- no external JavaScript or icon libraries

Cockpit serves the static HTML/CSS/JavaScript. The page reads its bookmark configuration from `/etc/cockpit/cockpit-bookmarks.json` through Cockpit's built-in `cockpit.file()` API.

## Install

Clone this repository on the mini PC and run:

```bash
git clone https://github.com/ami3go/cockpit-bookmarks.git
cd cockpit-bookmarks
sudo sh install.sh
```

Then reload Cockpit. **Bookmarks** will appear in the Cockpit sidebar under Tools.

The installer copies the extension to:

```text
/usr/local/share/cockpit/cockpit-bookmarks/
```

and creates an example configuration at:

```text
/etc/cockpit/cockpit-bookmarks.json
```

if that file does not already exist.

## Upgrade from the old `bookmarks` / `local-services` version

The installer is migration-aware. If `/etc/cockpit/local-services.json` exists and the new configuration does not, it copies the existing configuration to `/etc/cockpit/cockpit-bookmarks.json`. It also removes the old `/usr/local/share/cockpit/local-services/` package directory so Cockpit does not show duplicate entries.

The legacy configuration file is left untouched as a backup.

## Configure bookmarks

Edit:

```bash
sudo nano /etc/cockpit/cockpit-bookmarks.json
```

Example:

```json
{
  "title": "Mini PC Services",
  "subtitle": "Services hosted on this mini PC",
  "services": [
    {
      "name": "Grafana",
      "description": "Metrics and dashboards",
      "url": "http://{host}:3000",
      "icon": "📊",
      "group": "Monitoring"
    },
    {
      "name": "AdGuard Home",
      "description": "DNS and ad blocking",
      "url": "http://{host}:3000",
      "icon": "🛡️",
      "group": "Network"
    }
  ]
}
```

`{host}` is replaced in the browser with the hostname or IP address that you used to open Cockpit. For example, if Cockpit is open at `https://192.168.1.50:9090`, then `http://{host}:3000` becomes `http://192.168.1.50:3000`.

This avoids the common `localhost` problem: a bookmark to `http://localhost:3000` would refer to the computer running your browser, not the mini PC.

## Important limitation: services bound only to 127.0.0.1

A bookmark cannot make a service that listens only on `127.0.0.1` reachable from another computer. Such a service needs to listen on the mini PC's LAN interface or be exposed through a reverse proxy. Keep the service protected by your LAN firewall and authentication as appropriate.

## JSON fields

Each service supports:

- `name` — required display name
- `url` — required `http://` or `https://` URL; `{host}` is supported
- `description` — optional secondary text
- `icon` — optional text or emoji
- `group` — optional small category label

The page also includes client-side filtering. It deliberately does not perform health checks, because browser CORS rules and self-signed HTTPS certificates make generic status probing unreliable.

## Update

Pull the latest version and rerun the installer:

```bash
git pull
sudo sh install.sh
```

Your `/etc/cockpit/cockpit-bookmarks.json` is preserved.

## Uninstall

```bash
sudo sh uninstall.sh
```

The uninstall script removes the Cockpit extension but leaves configuration files in place.

## Compatibility

The package uses Cockpit's documented package manifest and `cockpit.js` file API. It declares Cockpit 239 or newer.

Cockpit searches `/usr/local/share/cockpit/` for system-wide locally installed packages, so this extension does not modify files under `/usr/share/cockpit/` that belong to your OS package manager.

## License

MIT
