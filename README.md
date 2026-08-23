# Cockpit Bookmarks

A lightweight Cockpit extension for organizing and launching web services hosted on a mini PC or server.

Cockpit Bookmarks stays small at runtime:

- no Docker
- no daemon or background service
- no database
- no Node.js process after installation
- no Python runtime

React, PatternFly, Node.js, and esbuild are build-time dependencies only. The installed application is static HTML/CSS/JavaScript served by Cockpit.

## Features

### Browse

- Cockpit-style React + PatternFly 6 interface
- follows Cockpit light/dark theme
- standard or compact card density
- responsive grouped card layout
- collapsible groups with browser-local collapse state
- Favorites section for pinned bookmarks
- search by name, description, group, URL, or tags
- filter by group
- keyboard shortcuts: `/` focuses search, arrow keys move between visible cards, `Enter` opens/selects, `Esc` clears search
- per-bookmark open behavior: new tab or same tab
- `{host}` substitution for the Cockpit host name/IP address

### Manage

Administrators can manage bookmarks directly from Cockpit:

- add and edit bookmarks
- delete with confirmation
- pencil **Edit mode** keeps management controls hidden by default
- edit mode automatically locks after two minutes of inactivity
- compact floating three-dot card action menu
- reorder bookmarks with drag-and-drop or Move up / Move down
- explicitly reorder groups
- move a bookmark to another group
- duplicate bookmarks with a fresh ID and collision-free name
- add/remove Favorites
- choose emoji/text icons
- add searchable tags
- duplicate name and URL warnings
- resolved `{host}` URL preview while editing
- modal-local write errors when a save operation fails

### Discover services

While Edit mode is enabled, administrators can use **Discover services** to inspect TCP listeners on the Cockpit host.

Discovery:

- runs `ss -H -ltnp` through Cockpit's host bridge
- scans only the local host; it does not scan the LAN
- groups duplicate IPv4/IPv6 listeners by port
- shows detected port, bind addresses, and process name when available
- recognizes common web-service ports/processes
- excludes known non-web/system listeners from automatic selection
- excludes Cockpit itself when identifiable
- marks loopback-only listeners because they may not be reachable from a remote browser
- avoids auto-adding ports already represented by local bookmarks
- shows a review dialog before writing anything
- adds selected services in one privileged atomic config update and one history snapshot

HTTP/HTTPS detection is intentionally conservative. Unknown protocols are not selected automatically, and unusual TLS ports may need manual correction after discovery.

### Page and configuration

- edit page title, subtitle, and eyebrow text
- optionally hide the eyebrow
- standard / compact display density
- explicit `groupOrder`
- live reload when `/etc/cockpit/cockpit-bookmarks.json` changes externally
- import JSON configuration with validation and confirmation
- export the complete current configuration as JSON
- automatic configuration history before every change
- restore one of the 10 most recent configuration snapshots
- administrator-only privileged writes
- atomic JSON updates through Cockpit's `cockpit.file().modify()` API
- existing v0.4 configurations and bookmarks without IDs remain compatible

## Build from source

Dependencies are locked in `package-lock.json` and installed reproducibly with npm:

```bash
npm ci
npm test
NODE_ENV=production make clean all
```

The build produces the compiled Cockpit package in `dist/`.

## Development install

```bash
make devel-install
sudo make install-config
```

Reload Cockpit. **Bookmarks** should appear under Tools.

Remove the development symlink with:

```bash
make devel-uninstall
```

## System install from source

```bash
make
sudo make install install-config
```

Installed package:

```text
/usr/local/share/cockpit/cockpit-bookmarks/
```

Configuration:

```text
/etc/cockpit/cockpit-bookmarks.json
```

## Install a prebuilt release

Release archives contain the compiled `dist/` tree, so Node.js and npm are not required on the target server.

```bash
cd cockpit-bookmarks-<version>
sudo make install-prebuilt install-config
```

`install-prebuilt` refuses to continue if the compiled `dist/` tree is missing. Reinstalling keeps an existing configuration unchanged, and uninstalling removes only the Cockpit package, not the JSON configuration.

## Create a release archive

```bash
npm ci
npm test
make release
```

This produces:

```text
release/cockpit-bookmarks-<version>.tar.gz
```

The archive includes the compiled Cockpit package, example configuration, installer Makefile, README, roadmap, changelog, security policy, and license.

## Continuous integration

GitHub Actions runs on pull requests and pushes to `main`. CI performs:

1. `npm ci`
2. unit tests
3. production release build
4. release-file and tarball-content validation
5. Node-free prebuilt installation test
6. uninstall/reinstall and configuration-preservation checks
7. artifact upload

## Edit mode

The pencil button controls Edit mode. While Edit mode is active, management actions become available, including Page settings, JSON import/export, History, group ordering, card actions, and service discovery.

Users without administrator privileges can browse and open bookmarks but cannot modify the system configuration.

## Bookmark fields

The editor supports:

- `name` — required display name
- `url` — required absolute `http://` or `https://` URL
- `description` — optional secondary text
- `group` — optional category
- `icon` — optional emoji or text icon
- `tags` — optional searchable metadata stored as an array
- `openMode` — optional `same-tab`; omitted/default means new tab
- `favorite` — optional boolean used for the Favorites section

New or edited bookmarks receive an internal `id` automatically. Existing entries without an `id` remain compatible.

## Manual configuration

The JSON remains human-readable and may be edited manually:

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
  "displayMode": "compact",
  "groupOrder": ["Apps", "Monitoring"],
  "services": [
    {
      "id": "grafana",
      "name": "Grafana",
      "description": "Metrics and dashboards",
      "url": "http://{host}:3000",
      "icon": "📊",
      "group": "Monitoring",
      "tags": ["dashboard", "metrics"],
      "favorite": true
    }
  ]
}
```

`id`, `displayMode`, `groupOrder`, `eyebrow`, `showEyebrow`, `tags`, `favorite`, and `openMode` are optional for manually created configurations. The application also maintains a top-level `history` array after UI changes; it contains up to 10 previous configuration snapshots.

`{host}` is replaced in the browser with the hostname or IP address used to open Cockpit. IPv6 hosts are bracketed automatically. Only absolute `http://` and `https://` targets are accepted.

## Import, export, and live reload

**Export JSON** downloads the current normalized configuration, including history. **Import JSON** validates the replacement before writing it and stores the previous state in History.

The application accepts configuration files up to 1 MiB.

Cockpit's file watcher refreshes the dashboard when the JSON file changes externally. Open editor/settings dialogs keep their unsaved draft state; a later write still uses the atomic `modify()` flow and detects stale bookmark targets.

## Ordering and groups

Bookmark order and group order are independent:

- bookmark drag-and-drop / Move up / Move down is constrained within a group
- Move to group changes a bookmark's group explicitly
- group heading ↑ / ↓ controls persist top-level `groupOrder`
- newly introduced groups are appended predictably
- stale group-order names are removed during normalization

Collapsed group state is browser-local and is not written into the shared JSON configuration. Active search temporarily exposes matching cards even when their group is collapsed.

## Source layout

```text
cockpit-bookmarks/
├── .github/workflows/
├── src/
│   ├── app.jsx
│   ├── app.css
│   ├── bookmarks.js
│   ├── discovery.js
│   ├── service-discovery.jsx
│   ├── service-discovery.css
│   ├── floating-action-menu.js
│   ├── floating-action-menu.css
│   ├── cockpit-dark-theme.js
│   ├── index.jsx
│   └── manifest.json
├── tests/
│   ├── bookmarks.test.mjs
│   └── discovery.test.mjs
├── examples/
│   └── cockpit-bookmarks.json
├── build.js
├── Makefile
├── package.json
├── package-lock.json
├── CHANGELOG.md
├── SECURITY.md
├── RELEASING.md
├── ROADMAP.md
├── LICENSE
└── README.md
```

## Runtime footprint

Node.js, npm, React source files, tests, and `node_modules/` are not required by the installed plugin. Cockpit serves compiled files from `dist/`; React and PatternFly execute in the browser.

## Important limitations

A bookmark cannot make a service listening only on `127.0.0.1` reachable from another computer. Such a service must listen on an appropriate interface or be exposed through a reverse proxy/tunnel.

Service discovery detects TCP listeners, not application health. It does not probe the LAN, does not detect UDP-only services, and cannot reliably infer arbitrary HTTP-vs-HTTPS configurations.

Generic service health checks remain intentionally deferred because browser-side probes are unreliable across CORS, authentication, mixed-content restrictions, and self-signed TLS certificates.

Whole-card browsing currently uses application-controlled navigation rather than a literal `<a>` wrapper. Left-click and keyboard activation are supported, but native browser link affordances such as link-specific context menus/middle-click are not yet equivalent to a normal anchor. This has been reviewed for v0.5 and remains a documented follow-up rather than a release blocker.

## Security

See `SECURITY.md` for supported versions, vulnerability reporting, and the extension's security model.

## Changelog

See `CHANGELOG.md` for release notes.

## License

MIT
