# Cockpit Bookmarks

A lightweight Cockpit extension for organizing links to web services hosted on a mini PC or server.

It stays small at runtime:

- no Docker
- no daemon or background service
- no database
- no Node.js process after installation
- no Python runtime

React, PatternFly, Node.js and esbuild are **build-time dependencies only**. The installed application is static HTML/CSS/JavaScript served by Cockpit.

## Features

- Cockpit-style React + PatternFly 6 interface
- follows Cockpit light/dark theme
- search/filter bookmarks
- add bookmarks from the Cockpit UI
- edit existing bookmarks
- delete bookmarks with confirmation
- administrator-only configuration changes
- atomic JSON updates through Cockpit's file API
- `{host}` substitution for the mini PC hostname/IP address
- no application server or database

## Build

Development packages are installed only for the build:

```bash
make
```

`make` runs `npm install` the first time and produces:

```text
dist/
├── index.html
├── index.css
├── index.js
└── manifest.json
```

For a smaller production bundle:

```bash
NODE_ENV=production make clean all
```

## Development install

Build and link the application into Cockpit for your current user:

```bash
make devel-install
```

Create the example system configuration once:

```bash
sudo make install-config
```

Reload Cockpit. **Bookmarks** should appear under Tools.

Remove the development symlink with:

```bash
make devel-uninstall
```

## System install

Build and install the Cockpit package system-wide:

```bash
make
sudo make install install-config
```

The application is installed at:

```text
/usr/local/share/cockpit/cockpit-bookmarks/
```

The bookmark configuration is stored at:

```text
/etc/cockpit/cockpit-bookmarks.json
```

## Add, edit, and delete bookmarks

Users who can obtain Cockpit administrator privileges get an **Add bookmark** button plus **Edit** and **Delete** actions on each card.

Changes are written to `/etc/cockpit/cockpit-bookmarks.json` using Cockpit's privileged `cockpit.file()` API with atomic `modify()` operations. The configuration file therefore stays root-owned; it does not need to be made globally writable.

Users without administrator privileges can still browse and open bookmarks, but the page operates in read-only mode.

The editor supports:

- `name` — required display name
- `url` — required `http://` or `https://` URL
- `description` — optional secondary text
- `group` — optional category
- `icon` — optional text or emoji

New bookmarks receive an internal `id` automatically. Existing entries without an `id` remain compatible and receive one the next time they are edited.

## Manual configuration

The JSON file remains intentionally human-readable and can still be edited manually:

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
      "id": "grafana",
      "name": "Grafana",
      "description": "Metrics and dashboards",
      "url": "http://{host}:3000",
      "icon": "📊",
      "group": "Monitoring"
    }
  ]
}
```

`id` is optional for manually created entries.

`{host}` is replaced in the browser with the hostname or IP address used to open Cockpit. For example, when Cockpit is open at `https://192.168.1.50:9090`, `http://{host}:3000` becomes `http://192.168.1.50:3000`.

Only `http://` and `https://` bookmark targets are accepted. Links open in a new browser tab with `noopener noreferrer`.

## Source layout

```text
cockpit-bookmarks/
├── src/
│   ├── app.jsx
│   ├── app.css
│   ├── cockpit-dark-theme.js
│   ├── index.jsx
│   └── manifest.json
├── examples/
│   └── cockpit-bookmarks.json
├── build.js
├── Makefile
├── package.json
└── README.md
```

## Runtime footprint

Node.js, npm, React source files and `node_modules/` are not required by the installed plugin. Cockpit serves the compiled files from `dist/`; React and PatternFly execute in the browser.

## Important limitation

A bookmark cannot make a service listening only on `127.0.0.1` reachable from another computer. Such a service must listen on an appropriate LAN interface or be exposed through a reverse proxy.

## License

MIT
