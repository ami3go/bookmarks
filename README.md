# Cockpit Bookmarks — Starter Kit trial

This branch is a trial refactor of **Cockpit Bookmarks** toward the official Cockpit Starter Kit development model.

It keeps the plugin lightweight at runtime:

- no Docker
- no daemon or background service
- no database
- no Node.js process after installation
- no Python runtime

React, PatternFly, Node.js and esbuild are **build-time dependencies only**. The build output is static HTML/CSS/JavaScript served by Cockpit from `dist/`.

## What changed in this branch

The application source now lives under `src/`, builds into `dist/`, uses React + PatternFly 6, follows Cockpit's current dark/light theme, and provides Starter-Kit-style `make` targets for development and installation.

This is intentionally a smaller scaffold than the full upstream Starter Kit. RPM/Packit packaging, translations, VM integration tests and release automation are not included yet.

## Branch safety

The existing implementation remains untouched on `main`.

To try this version:

```bash
git switch starter-kit-trial
```

To return to the current implementation:

```bash
git switch main
```

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

Install the built `dist/` tree for your current user:

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
    }
  ]
}
```

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
