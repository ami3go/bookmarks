# Changelog

All notable changes to Cockpit Bookmarks are documented here.

The project follows semantic versioning where practical.

## [Unreleased]

### Added

- Unified **Applications** manager for terminal and web-application launchers, with Running/Stopped/Failed state, Stop, Restart, View output, Edit, and confirmed Delete actions.
- Safe launcher-import review that lists executable commands, bind addresses, write capability, timeouts, and requires explicit command trust before importing launchers.
- Oversized-configuration recovery that can perform one larger privileged read and remove history while preserving bookmarks and page settings.
- Regression coverage for configuration conflicts/size recovery, host-side terminal inspection, launcher pending tabs/state, page-settings preview, collapsed groups, secure UUID fallback, and launcher execution paths.

### Changed

- Launcher commands remain human-readable in configuration and are resolved against the host `PATH` with `command -v` only when launched; existing absolute paths remain valid.
- GoTTY/ttyd discovery now reduces process command lines to security facts on the host instead of returning redacted argv to the browser.
- Application and terminal launcher output is captured per run in a private per-user runtime file, avoiding stale journal URLs and enabling View output.
- Page-settings preview now uses React state instead of CSS `:has()` rules and previews hidden title/header/eyebrow, search visibility, and card density without prematurely clearing the saved search query.
- Ordinary bookmark card titles are real browser links; launcher cards retain start-before-open button semantics. Arrow-key card navigation only activates when focus is already within the card grid.
- Source builds default to production mode, while `make dev` and `make watch` explicitly use development mode. System installs replace stale compiled assets before copying the new build.
- Configuration writes use optimistic file tags with bounded conflict retries and enforce the 1 MiB write budget by trimming oldest history first.

### Fixed

- Exceptions thrown by configuration transforms now reject the write instead of leaving the UI pending indefinitely.
- Imported files are migrated through the schema boundary before validation; future schema versions are rejected rather than silently restamped.
- ttyd/GoTTY discovery correctly handles credential option spellings and ttyd option grammar without exposing credential values to the browser.
- Launcher bind/URL handling now supports IPv6 literals and resolves ttyd hostname bindings on the host.
- Collapsed-group state is no longer erased by the placeholder configuration before the real file finishes loading.
- Bookmark/launcher IDs use cryptographically secure UUID generation even when `crypto.randomUUID()` is unavailable.

## [0.7.1] - 2026-09-17

### Changed

- Terminal and application launchers now use the same fixed Auto-stop selector: `∞ — No timeout`, 10m, 30m, 1h, 3h, and 8h.
- New GoTTY, ttyd, Custom app, and Agent of Empires launchers default to `∞ — No timeout` instead of a numeric timeout.
- Existing positive custom timeout values remain selectable as an `existing` option when editing older launcher configurations.

### Fixed

- `0` now has an explicit, consistent meaning across terminal and application launchers: no automatic timeout. In this mode transient systemd units omit `RuntimeMaxSec` entirely.
- Agent of Empires and other web applications no longer render the legacy numeric Auto-stop textbox in the final v0.7.1 build.
- Release metadata is bumped to 0.7.1 so the corrected launcher UI cannot be confused with earlier intermediate builds labeled 0.7.0.

## [0.7.0] - 2026-09-16

### Added

- Unified **Add app** workflow with Custom, GoTTY, ttyd, and Agent of Empires presets.
- Agent of Empires preset prefers its native TCP port 8080 and falls back to the managed application port range when needed.
- Shared service and launcher runtime layers for bookmark opening, transient systemd units, port probing, readiness checks, logs, and launcher shutdown.
- Central React configuration and administrator-permission providers.
- Versioned configuration migration with `schemaVersion: 1`; legacy launcher groups migrate to the Applications category before the UI consumes the configuration.
- Component-level UI regression tests using React Testing Library and jsdom.

### Changed

- Dashboard composition is split into focused header, edit-toolbar, service-view, keyboard/timeout, and bookmark-management modules instead of one large application component.
- Bookmark management dialogs are split into dedicated editor, move, delete, settings, import, and history components.
- Terminal/application launcher forms share reusable form fields and runtime infrastructure.
- Card action menus use PatternFly Dropdown/MenuToggle directly instead of DOM-cloned floating menus.
- Native select/checkbox controls in the dashboard, launcher forms, settings, and discovery are replaced with PatternFly controls.
- PatternFly packages are updated from 6.1.0 to 6.6.1 while React remains on 18.3.1.
- Package and lockfile metadata are aligned to 0.7.0 and the Debian package revision resets to `0.7.0-1`.

### Reliability and maintainability

- Removed MutationObserver/DOM-proxy UI routing used by older header and card-editor integrations.
- Removed global launcher `window.open` interception; cards and action menus now route through explicit service strategies.
- Removed obsolete GoTTY/application manager and floating-menu compatibility implementations where no callers remain.
- Launcher editing receives the real service object rather than rediscovering cards from rendered text.
- Existing v0.6 and older configuration files remain readable through the migration/normalization boundary.

## [0.6.0] - 2026-09-13

### Added

- Host-side TCP availability indicators for bookmarks, with bounded checks on page load and a manual refresh summary.
- Multiple addresses per bookmark while keeping the existing URL as the primary/default address.
- User card actions outside Edit mode: Open in new tab, Copy URL, and locally generated QR code.
- Dashboard service summary showing online, offline, and unknown counts.
- Expanded icon presets and optional theme-safe card accent presets.
- First-class GoTTY discovery: terminal-specific bookmark defaults, process-aware TLS/base-path inference, credential redaction, `--permit-write` warnings, and safe handling of random-URL mode.
- On-demand terminal launcher management for both GoTTY and ttyd, including presets, automatic free-port selection, per-launcher auto-stop, and host placeholder expansion.
- Terminal-provider compatibility checks and process-aware discovery support for GoTTY and ttyd.

### Changed

- New terminal launchers default their listen address to `{host}` while legacy launchers without a stored address continue to fall back to `127.0.0.1`.
- Terminal launcher editing now uses stable launcher IDs and opens from the standard bookmark Edit workflow.
- Terminal launcher and service discovery controls are consolidated into the Edit-mode management card alongside Page settings, Import/Export, and History.
- The Edit-mode management card now places its status text on the top row and keeps all management actions on one horizontal row below it, with horizontal scrolling on narrow screens.
- Native dropdown controls follow the active Cockpit light/dark theme instead of forcing a light popup surface.
- Terminal-server and card-accent selectors use the same PatternFly foreground, background, and border tokens as the surrounding form.

### Reliability and compatibility

- Fixed an Edit-mode freeze caused by the terminal-card MutationObserver repeatedly rewriting the Edit button text and retriggering itself.
- Existing terminal launchers preserve their stored listen addresses and provider behavior.
- `{host}` is expanded to the current Cockpit hostname/IP before GoTTY or ttyd is started, with regression coverage for the new default and legacy fallback.
- Existing v0.5 configuration data remains compatible with the v0.6 launcher and management UI changes.

### Packaging

- Debian revisions `0.5.0-2` and `0.5.0-3` added AppStream metadata, Cockpit package relationships, package tests, and the local APT update-notification test helper during development.
- The v0.6.0 release resets the Debian package revision to `0.6.0-1`.

## [0.5.0] - 2026-08-23

### Added

- Optional Standard / Compact card display density.
- Explicit persisted group ordering with group Move up / Move down controls.
- Collapsible groups with browser-local collapse state.
- Favorites / pinned bookmarks with a top Favorites section.
- Keyboard navigation: `/` focuses search, arrow keys move across visible cards, Enter activates, and Esc clears search.
- Per-bookmark opening behavior: new tab or same tab.
- Duplicate bookmark action with fresh IDs and collision-free copy name.
- Move to group action from the card menu.
- Live configuration reload through Cockpit's file watch API.
- Modal-local write errors for editor, move, delete, settings, import, and history actions.
- Page visibility controls for the header, title, and search bar, configurable from Page settings in Edit mode.
- Host-local **Discover services** workflow that inspects listening TCP sockets with `ss`, classifies likely web services, prevents obvious duplicate port additions, and presents a review dialog before writing bookmarks.
- Discovery helper tests covering socket parsing, duplicate detection, safe defaults, ambiguous port handling, multi-process listener classification, and non-web listener exclusions.

### Changed

- Compact mode reduces card width, spacing, icon size, and description footprint so larger service collections fit on screen more efficiently.
- Group section order is independent of bookmark order while remaining backward compatible with v0.4 configurations.
- Search temporarily exposes matches inside collapsed groups.
- Favorite bookmarks remain visible in their original group in addition to the Favorites section.
- Discovered bookmarks are added under the `Discovered` group in one privileged atomic config update/history snapshot.
- Discovery no longer treats generic TCP port 9100 as web by port number alone; web-like process detection is required before it is recommended.
- Discovery evaluates every reported process sharing a listening port before deciding whether it is safe to recommend.
- Stable bookmark IDs are authoritative mutation targets; if an externally changed bookmark ID disappears, edit/delete/move actions fail safely instead of falling back to a lookalike bookmark.
- Package and lockfile version metadata are aligned to `0.5.0`.
- Build watch mode refreshes copied static files such as `manifest.json`, and Makefile source dependency tracking now covers nested files/directories and additions/deletions.
- Header, title, and search visibility are independent. Group filtering, Add bookmark, and Edit mode controls remain available when header/title content is hidden.
- Page visibility checkboxes preview their effect immediately while Page settings is open; Save settings remains the persistence point.
- Native browser dropdown controls use explicit system-aware theming so option text remains readable in Cockpit dark mode.

### Reliability and compatibility

- Existing v0.4 JSON configurations continue to normalize without `displayMode`, `groupOrder`, `favorite`, `openMode`, `showHeader`, `showTitle`, or `showSearch` fields.
- Visibility settings are included in import/export and History snapshots; legacy History snapshots restore page elements as visible.
- Hiding Search clears any active text query so an invisible search filter cannot remain active; hiding Header or Title does not alter the selected group filter.
- External JSON file changes refresh the displayed configuration without replacing unsaved modal draft fields.
- Existing privileged `cockpit.file().modify()` writes and history conflict protection remain in place.
- Service discovery does not scan the LAN and does not write anything until the administrator confirms selected candidates.
- CI includes regression checks for recursive Makefile rebuild invalidation and development-watch static-file refresh.
- Whole-card navigation semantics were reviewed. Native anchor-style middle-click/context-menu behavior remains a documented follow-up rather than a v0.5 release blocker.

## [0.4.0] - 2026-08-22

### Added

- Bookmark groups with group filtering and grouped sections.
- Bookmark reordering with drag-and-drop and accessible move up/down controls.
- Page settings for title, subtitle, eyebrow text, and eyebrow visibility.
- JSON configuration import and export.
- Configuration history with restoration of recent snapshots.
- Duplicate name and URL warnings.
- Resolved `{host}` URL preview in the bookmark editor.
- Emoji/service icon picker while retaining custom icon support.
- Optional searchable tags.
- Improved first-run and empty-filter states.
- Automatic edit-mode locking after inactivity.
- Unit tests for configuration helpers, validation, ordering, history, tags, and import normalization.

### Changed

- Bookmark cards are the service link and open in a new browser tab by default.
- Card management actions are compacted into a three-dot menu that appears only in edit mode; Edit, Move up, Move down, and Delete live inside the menu.
- The three-dot menu floats at the document/window level so it is not clipped by cards and does not create card scrolling.
- Edit and Delete actions are protected by the pencil edit-mode toggle.
- Configuration logic is separated into `src/bookmarks.js` for easier testing and maintenance.
- Build dependencies are locked with `package-lock.json` and installed reproducibly with `npm ci`.
- The dark-theme synchronizer is an independently written MIT implementation.

### Security and reliability

- Administrator privileges remain required for configuration writes.
- Configuration writes use Cockpit's privileged file API and atomic modification flow.
- Delete operations retain an explicit confirmation step.
- CI verifies dependency installation, unit tests, production build output, release artifacts, and Node-free installation.

## [0.3.0]

### Added

- Add, edit, and delete bookmarks from the Cockpit UI.
- Administrator permission detection and read-only mode.
- Stable IDs for new and edited bookmarks.
- Pencil edit-mode safety toggle.
- PatternFly forms and validation.

## [0.2.0]

### Changed

- Migrated the UI to React and PatternFly 6 with an esbuild-based static production bundle.

## [0.1.0]

### Added

- Initial lightweight Cockpit bookmark page backed by JSON configuration.
