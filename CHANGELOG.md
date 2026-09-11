# Changelog

All notable changes to Cockpit Bookmarks are documented here.

The project follows semantic versioning where practical.

## [Unreleased]

### Packaging

- Debian revision `0.5.0-2` installs AppStream metainfo under `/usr/share/metainfo/` so Cockpit's Applications page can recognize an installed Cockpit Bookmarks package.
- The Debian package now declares that it enhances Cockpit and suggests `cockpit-packagekit` for Applications-page management.
- Debian package tests verify the AppStream component ID, Cockpit extension relationship, `cockpit-manifest` launchable, package relationships, and Node-free rebuild path.
- Debian revision `0.5.0-3` is the current development package revision and can be exposed through the included local APT test helper to exercise update notifications against a real APT candidate.
- The local APT test helper creates and removes a temporary trusted `file:` repository under `/var/local/cockpit-bookmarks-apt`; it is for local testing only, not production distribution.

## [0.5.0] - 2026-08-23

### Added

- Optional Standard / Compact card display density.
- Explicit persisted group ordering with group Move up / Move down controls.
- Collapsible groups with browser-local collapse state.
- Favorites / pinned bookmarks with a top Favorites section.
- Keyboard navigation: `/` focuses search, arrow keys move across visible cards, Enter activates, and Esc clears search.
- Per-bookmark opening behavior: new tab or same tab.
- Duplicate bookmark action with fresh IDs and collision-free copy names.
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
- Discovered bookmarks are added under the `Discovered` group in one privileged atomic update/history snapshot.
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
