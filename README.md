# Cockpit Bookmarks

Cockpit Bookmarks is a lightweight Cockpit extension for organizing web services and launching optional on-demand applications on a mini PC or server.

The installed UI is static HTML/CSS/JavaScript served by Cockpit. It has no database and no always-on application daemon of its own. Optional terminal and application launchers create transient **per-user systemd services** only when a user starts them.

## Features

### Browse

- React + PatternFly 6 Cockpit UI with light/dark theme support
- standard or compact card density
- grouped and collapsible bookmarks with browser-local collapse state
- Favorites section
- search and group filtering
- optional eyebrow/header/title/search visibility
- real browser links for normal bookmarks, including native middle-click/context-menu behavior
- selectable alternate addresses per bookmark
- `{host}` substitution for the hostname/IP used to open Cockpit
- host-side reachability status with online/offline/unknown summary
- Copy URL and locally generated QR code actions

Keyboard shortcuts are intentionally scoped: `/` focuses search, `Esc` clears search, and arrow-key card navigation is used only while focus is already inside the card grid so normal page scrolling is not stolen.

### Manage

Administrators can enable the pencil **Edit mode** to:

- add, edit, move, reorder, duplicate, favorite, and delete bookmarks
- configure page text, visibility, and card density with live preview
- import/export JSON configuration
- restore configuration history
- discover local TCP services
- add and edit terminal/application launchers
- use the unified **Applications** manager for launcher state, Stop, View output, Edit, and confirmed Delete

Edit mode locks automatically after two minutes of inactivity when no management dialog is open.

### On-demand applications

**Add app** supports:

- Custom web applications
- Agent of Empires
- GoTTY terminals
- ttyd terminals
- terminal presets for MC, btop, and Fish

Launcher commands are stored as entered. At launch time, names without `/` are resolved against the host user's real `PATH` with `command -v`; absolute paths remain unchanged.

Launcher state is read from the user's systemd manager and shown as Running, Stopped, or Failed. Stop/Restart/View output are available from launcher card menus. Output is captured per run in a private directory under `/run/user/<uid>/cockpit-bookmarks/` rather than relying on journal visibility.

Terminal launchers are powerful remote-shell endpoints. Review their listen address, terminal-server authentication, writable mode, and auto-stop setting before starting them. Current terminal presets retain the v0.7 behavior: they bind to `{host}`, are writable, and default to **No timeout**. See [SECURITY.md](SECURITY.md) and [docs/GOTTY-LAUNCHERS.md](docs/GOTTY-LAUNCHERS.md).

### Discover services

**Discover services** inspects listening TCP sockets on the Cockpit host with `ss -H -ltnp`. It does not scan the LAN.

Discovery:

- groups duplicate IPv4/IPv6 listeners by port
- recognizes common web services and known non-web/system listeners
- marks loopback-only listeners
- avoids obvious duplicate local bookmark ports
- provides process-aware GoTTY/ttyd handling when the process PID is visible
- requires confirmation before writing bookmarks

GoTTY/ttyd process inspection runs on the host. The inspector parses `/proc/<pid>/cmdline` there and returns only derived facts such as TLS, write access, authentication presence, random URL/read-only flags, and base path. Credential values and arbitrary argv are not sent to the browser.

## Configuration

The shared configuration is:

```text
/etc/cockpit/cockpit-bookmarks.json
```

Writes require Cockpit administrator privileges. Configuration changes use optimistic file tags and bounded retries so concurrent modifications do not silently overwrite one another.

The normal write budget is 1 MiB. Oldest history snapshots are trimmed first when necessary. Reads allow a larger recovery margin, and an administrator can use **Remove history and repair** if a configuration has already grown beyond the normal read ceiling but can be repaired by dropping history.

Imports pass through the same schema migration and launcher validation boundary as normal configuration. Imports containing launchers list the executable configuration and require an explicit trust confirmation before they are accepted. Files from a future unsupported schema version are rejected.

## Installation

### Requirements

Every installation requires:

- Cockpit
- administrator or `sudo` access for system-wide installation
- a modern browser

Prebuilt releases and Debian packages do **not** require Node.js on the target host. Source builds require Node.js 18+, npm, and GNU Make. Service discovery additionally needs `ss` from `iproute2`.

### Debian/Ubuntu package

Download the matching `.deb` and checksum from a GitHub release, verify if desired, then install with:

```bash
sha256sum cockpit-bookmarks_<version>-<revision>_all.deb
sudo apt install ./cockpit-bookmarks_<version>-<revision>_all.deb
```

The package installs the Cockpit UI under `/usr/share/cockpit/cockpit-bookmarks/` and creates `/etc/cockpit/cockpit-bookmarks.json` only if it does not already exist. Existing configuration is preserved across upgrades and normal removal.

### Prebuilt release tarball

```bash
tar -xzf cockpit-bookmarks-<version>.tar.gz
cd cockpit-bookmarks-<version>
sudo make install-prebuilt install-config
```

The Makefile install path is `/usr/local/share/cockpit/cockpit-bookmarks/`.

### Install from source

```bash
npm ci
npm test
make
sudo make install install-config
```

`make` now builds **production** assets by default. It removes the old installed Cockpit directory before copying the new build so stale hashed/static assets do not accumulate.

For a one-off development bundle use:

```bash
make dev
```

For a development symlink and watcher:

```bash
make devel-install
sudo make install-config
make watch
```

`make dev`, `make devel-install`, and `make watch` explicitly use development mode.

### Update

Debian/Ubuntu:

```bash
sudo apt install ./cockpit-bookmarks_<new-version>-<revision>_all.deb
```

Prebuilt tarball:

```bash
sudo make install-prebuilt install-config
```

Source checkout:

```bash
git pull --ff-only
npm ci
npm test
make clean
make
sudo make install
```

### Uninstall

Debian package, preserving configuration:

```bash
sudo apt remove cockpit-bookmarks
```

Purge package and configuration:

```bash
sudo apt purge cockpit-bookmarks
```

Makefile installation:

```bash
sudo make uninstall
```

The Makefile uninstall deliberately keeps `/etc/cockpit/cockpit-bookmarks.json`.

## Build and test

Install dependencies and run all unit/UI regression tests:

```bash
npm ci
npm test
```

Production build:

```bash
make clean all
```

Development build:

```bash
make dev
```

Release archive and Debian package:

```bash
make release-all
```

Expected artifacts:

```text
release/cockpit-bookmarks-<version>.tar.gz
release/cockpit-bookmarks_<version>-<revision>_all.deb
```

CI also validates recursive rebuilds, watch-mode static refresh, production source maps, release contents, Node-free prebuilt installation, uninstall/reinstall configuration preservation, and Debian package behavior.

## Update notifications

The built-in package update notice is for installations managed by an APT repository that provides `cockpit-bookmarks`. A locally installed standalone GitHub `.deb` has no newer repository candidate, so the plugin does not claim that an update is available. For standalone `.deb` installations, check GitHub releases when you want to upgrade.

## Manual configuration

A minimal configuration is:

```json
{
  "schemaVersion": 1,
  "title": "Mini PC Services",
  "subtitle": "Services hosted on this mini PC",
  "eyebrow": "Mini PC",
  "showEyebrow": true,
  "showHeader": true,
  "showTitle": true,
  "showSearch": true,
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

`{host}` is replaced with the host used to open Cockpit; IPv6 URL hosts are bracketed automatically. Bookmark targets are restricted to absolute `http://` and `https://` URLs.

## Source layout

The main implementation is organized by responsibility rather than one monolithic component:

```text
cockpit-bookmarks/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── codeql.yml
│   │   └── release.yml
│   └── dependabot.yml
├── docs/
├── packaging/
├── src/
│   ├── app.jsx
│   ├── app-providers.jsx
│   ├── bookmarks.js
│   ├── cockpit-config.js
│   ├── config-migrations.js
│   ├── dashboard-header.jsx
│   ├── use-dashboard-view.js
│   ├── use-bookmark-management.js
│   ├── page-settings.js
│   ├── use-page-settings.js
│   ├── service-card.jsx
│   ├── service-runtime.js
│   ├── launcher-runtime.js
│   ├── terminal-launcher.js
│   ├── application-launcher.js
│   ├── terminal-launcher-manager.jsx
│   ├── terminal-inspect.js
│   ├── discovery.js
│   └── terminal-service-discovery.jsx
├── tests/
├── tests-ui/
├── examples/
├── build.js
├── Makefile
├── package.json
├── package-lock.json
├── CHANGELOG.md
├── SECURITY.md
└── README.md
```

## Runtime footprint

Node.js, npm, source files, tests, and `node_modules/` are not required after a Debian or prebuilt installation. Cockpit serves the compiled frontend. On-demand launchers, when used, run as transient services in the current user's systemd manager.

## Security and limitations

- A bookmark cannot make a service bound only to loopback reachable from another computer.
- Discovery inspects TCP listeners only; it is not an application-health or LAN scanner.
- Browser and host firewall/TLS/authentication policies still govern access to linked services.
- Launcher configuration is executable configuration. Do not import it from an untrusted source.
- Terminal launchers expose an interactive shell according to their bind/auth/write settings; treat them as privileged remote access.

See [SECURITY.md](SECURITY.md) for the security model and vulnerability reporting, [CHANGELOG.md](CHANGELOG.md) for release history, and the `docs/` directory for launcher-specific details.
