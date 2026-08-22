# Cockpit Bookmarks

A lightweight Cockpit extension for organizing links to web services hosted on a mini PC or server.

Cockpit Bookmarks stays small at runtime:

- no Docker
- no daemon or background service
- no database
- no Node.js process after installation
- no Python runtime

React, PatternFly, Node.js and esbuild are **build-time dependencies only**. The installed application is static HTML/CSS/JavaScript served by Cockpit.

## Features

### Browse

- Cockpit-style React + PatternFly 6 interface
- follows Cockpit light/dark theme
- responsive grouped card layout
- whole card opens the service in a new browser tab
- search by name, description, group, URL, or tags
- filter by group
- `{host}` substitution for the mini PC hostname/IP address

### Manage

Administrators can manage bookmarks directly from Cockpit:

- add bookmarks
- edit bookmarks
- delete with confirmation
- pencil **Edit mode** keeps Edit/Delete/reorder controls locked by default
- edit mode automatically locks after two minutes of inactivity
- reorder bookmarks with drag-and-drop
- accessible Move up / Move down controls as an alternative to dragging
- group bookmarks into sections
- choose from common emoji icons or enter a custom icon
- add searchable tags
- duplicate name and URL warnings
- resolved `{host}` URL preview while editing

### Page and configuration

- edit page title, subtitle, and eyebrow text
- optionally hide the eyebrow
- import JSON configuration with validation and confirmation
- export the current configuration as JSON
- automatic configuration history before every change
- restore one of the 10 most recent configuration snapshots
- administrator-only privileged writes
- atomic JSON updates through Cockpit's `cockpit.file().modify()` API
- existing configurations and bookmarks without IDs remain compatible

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

Run the dependency-free helper tests with:

```bash
npm test
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

The configuration is stored at:

```text
/etc/cockpit/cockpit-bookmarks.json
```

## Edit mode

The pencil button in the top-right controls edit mode. Edit and Delete are visible but disabled until edit mode is enabled. Reorder, page settings, import/export, and configuration history controls appear while edit mode is active.

Delete still requires confirmation. Edit mode automatically locks after two minutes of inactivity and pauses its timer while a management dialog is open.

Users without administrator privileges can browse and open bookmarks but cannot modify the system configuration.

## Bookmark fields

The editor supports:

- `name` — required display name
- `url` — required absolute `http://` or `https://` URL
- `description` — optional secondary text
- `group` — optional category; existing groups are suggested
- `icon` — optional emoji or text icon
- `tags` — optional searchable metadata stored as an array

New or edited bookmarks receive an internal `id` automatically. Existing entries without an `id` remain compatible.

## Manual configuration

The JSON file remains human-readable and can still be edited manually:

```bash
sudo nano /etc/cockpit/cockpit-bookmarks.json
```

Example:

```json
{
  "title": "Mini PC Services",
  "subtitle": "Services hosted on this mini PC",
  "eyebrow": "Mini PC",
  "showEyebrow": true,
  "services": [
    {
      "id": "grafana",
      "name": "Grafana",
      "description": "Metrics and dashboards",
      "url": "http://{host}:3000",
      "icon": "📊",
      "group": "Monitoring",
      "tags": ["dashboard", "metrics"]
    }
  ]
}
```

`id`, `eyebrow`, `showEyebrow`, and `tags` are optional for manually created configurations. The application also maintains a top-level `history` array after the first UI change; it contains up to 10 previous configuration snapshots.

`{host}` is replaced in the browser with the hostname or IP address used to open Cockpit. For example, when Cockpit is open at `https://192.168.1.50:9090`, `http://{host}:3000` becomes `http://192.168.1.50:3000`. IPv6 hosts are bracketed automatically.

Only absolute `http://` and `https://` targets are accepted.

## Import and export

**Export JSON** downloads the complete current configuration, including history. **Import JSON** validates the file before replacing the active configuration. The current state is written into history before the import is committed.

The application currently accepts configuration files up to 1 MiB.

## Ordering and groups

Bookmarks are rendered in group sections. Reordering is intentionally constrained to bookmarks within the same group so the visual result is predictable. Use either the drag handle or the keyboard-accessible Move up / Move down buttons while edit mode is active.

Group section order follows the first occurrence of each group in the configuration file.

## Source layout

```text
cockpit-bookmarks/
├── src/
│   ├── app.jsx
│   ├── app.css
│   ├── bookmarks.js
│   ├── cockpit-dark-theme.js
│   ├── index.jsx
│   └── manifest.json
├── tests/
│   └── bookmarks.test.mjs
├── examples/
│   └── cockpit-bookmarks.json
├── build.js
├── Makefile
├── package.json
├── ROADMAP.md
└── README.md
```

## Runtime footprint

Node.js, npm, React source files, tests, and `node_modules/` are not required by the installed plugin. Cockpit serves the compiled files from `dist/`; React and PatternFly execute in the browser.

## Important limitations

A bookmark cannot make a service listening only on `127.0.0.1` reachable from another computer. Such a service must listen on an appropriate LAN interface or be exposed through a reverse proxy.

Service health checks are intentionally not part of the current release. Generic browser-side probes are unreliable across CORS policies, authentication, mixed-content rules, and self-signed TLS certificates.

## License

MIT
