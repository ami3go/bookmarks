# Changelog

All notable changes to Cockpit Bookmarks are documented here.

The project follows semantic versioning where practical.

## [0.5.0] - Unreleased

### Added

- Optional compact card display density, configurable from Page settings.
- Display density is stored in the JSON configuration and included in import/export and history snapshots.
- Explicit group ordering with Move group up / Move group down controls in edit mode.
- Optional top-level `groupOrder` configuration that appends new groups predictably and removes stale group names automatically.

### Changed

- Compact mode reduces card width, spacing, icon size, and description footprint so larger service collections fit on screen more efficiently.
- Group section order is independent of bookmark order while remaining backward compatible with v0.4 configurations.

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

- Bookmark cards are the service link and open in a new browser tab.
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
- CI verifies dependency installation, unit tests, production build output, and release artifacts.

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
