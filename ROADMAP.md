# Cockpit Bookmarks roadmap

## v0.5.0 — density, organization, and discovery

Status: feature implementation and repository-side hardening are complete on `v0.5-development`. The released `v0.4.0` tag remains frozen. Final real-host Cockpit smoke testing remains before v0.5 is considered release-ready.

### Phase 1 — display density

- [x] Add a Standard cards / Compact cards setting
- [x] Keep v0.4 configurations backward compatible
- [x] Preserve display mode through import/export
- [x] Preserve display mode in configuration history and restore
- [x] Add unit coverage for display-mode normalization and history
- [ ] Smoke-test compact mode in Cockpit on desktop and narrow layouts

### Phase 2 — organization

- [x] Store optional top-level group order without changing bookmark group names
- [x] Add Move group up / Move group down controls in edit mode
- [x] Keep unknown/new groups predictable when no explicit order exists
- [x] Preserve group order through import/export and history
- [x] Add collapsible groups with browser-local state
- [x] Add Favorites / pinned services
- [x] Add Duplicate and Move to group actions
- [x] Add unit tests for group ordering and bookmark metadata helpers
- [ ] Smoke-test group ordering, collapse state, Favorites, Duplicate, and Move to group in Cockpit

### Phase 3 — navigation and daily-use UX

- [x] Add `/` search focus shortcut
- [x] Add arrow-key navigation across visible cards
- [x] Keep Enter activation and Esc search clearing
- [x] Add per-bookmark new-tab / same-tab behavior
- [x] Review whole-card navigation semantics
- [ ] Follow up on native anchor-equivalent middle-click/context-menu behavior in a later release if needed

### Phase 4 — live configuration integration

- [x] Watch the Cockpit JSON file for external edits
- [x] Refresh the UI safely after external configuration changes
- [x] Keep unsaved editor/settings/import draft state separate from watched configuration state
- [x] Surface external-file parse/read failures clearly
- [x] Improve modal-local write error feedback
- [ ] Smoke-test external config editing while management dialogs are open

### Phase 5 — service discovery

- [x] Add administrator-only Discover services flow
- [x] Inspect host-local listening TCP sockets with Cockpit `spawn()` + `ss`
- [x] Avoid LAN/network-wide scanning
- [x] Parse IPv4/IPv6 listeners into unique port candidates
- [x] Capture process/bind information when available
- [x] Mark loopback-only listeners
- [x] Exclude known non-web/system listeners from automatic selection
- [x] Exclude Cockpit itself when identifiable
- [x] Detect already-bookmarked local ports
- [x] Review candidates before any write
- [x] Add selected discoveries in one privileged atomic write/history snapshot
- [x] Add discovery parser/helper tests
- [x] Harden ambiguous TCP 9100 behavior so generic printer listeners are not preselected as web
- [ ] Smoke-test discovery against real services on the Cockpit host

### Phase 6 — release quality

- [x] Align package and lockfile version metadata to 0.5.0
- [x] Update README, CHANGELOG, ROADMAP, and example configuration
- [x] Review configuration compatibility and unknown-field preservation
- [x] Review admin-only write boundaries
- [x] Review service-discovery failure/duplicate paths
- [x] Expand pure helper coverage for new v0.5 behavior
- [x] Final CI on the release-candidate code head
- [ ] Re-run administrator and non-administrator Cockpit smoke tests
- [ ] Verify light/dark/auto themes and responsive layouts

## Deferred by design

- Generic service health checks remain deferred because arbitrary browser-side checks are unreliable across CORS, authentication, mixed-content restrictions, and self-signed TLS.
- Arbitrary uploaded image icons remain deferred because they require a secure file persistence/serving design beyond the lightweight JSON-only model.
- Localization/i18n remains optional until the project has enough users/translations to justify the maintenance cost.
- Native anchor-equivalent whole-card browser affordances remain a possible follow-up; current left-click/keyboard navigation remains supported.

## v0.4.0 — management release

Status: released on 2026-08-22 as `v0.4.0`.

Delivered:

- administrator-only add/edit/delete and edit-mode safety
- grouped bookmark browsing and group filtering
- drag-and-drop plus Move up / Move down ordering within groups
- page title/subtitle/eyebrow customization
- JSON import/export and automatic configuration history
- duplicate warnings, URL preview, icons, and searchable tags
- compact three-dot per-card management menu rendered at window level
- dependency-free helper tests
- reproducible `npm ci` builds and GitHub Actions CI
- precompiled Node-free release archive and install test
- MIT licensing cleanup, changelog, security policy, and release procedure

## Current architectural constraints

### Service reachability

`{host}` substitutes the hostname or IP used to open Cockpit. It does not expose services bound only to `127.0.0.1`.

### Bookmark reordering

Bookmark drag-and-drop and Move up / Move down operate within a group. Cross-group movement uses the explicit Move to group action.

### Configuration history

History is stored in the same JSON configuration file and is capped at 10 snapshots. This preserves the no-database/no-daemon architecture but can increase configuration size for very large collections.

### Discovery

Discovery reports local TCP listeners only. It does not prove that a service is HTTP/HTTPS or healthy, and it does not detect UDP-only services. Protocol inference is deliberately conservative and always presented for review before bookmarks are written.

See `RELEASING.md` for the release procedure.
