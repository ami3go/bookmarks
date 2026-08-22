# Cockpit Bookmarks roadmap

## v0.5.0 — density and organization

Status: active development on `v0.5-development`. The released `v0.4.0` tag remains frozen.

### Phase 1 — display density

- [x] Add a Standard cards / Compact cards setting
- [x] Keep v0.4 configurations backward compatible
- [x] Preserve display mode through import/export
- [x] Preserve display mode in configuration history and restore
- [x] Add unit coverage for display-mode normalization and history
- [ ] Smoke-test compact mode in Cockpit on desktop and narrow layouts

### Phase 2 — explicit group ordering

- [x] Store optional top-level group order without changing bookmark group names
- [x] Add Move group up / Move group down controls in edit mode
- [x] Keep unknown/new groups predictable when no explicit order exists
- [x] Preserve group order through import/export and history
- [x] Add unit tests for group ordering
- [ ] Smoke-test group ordering in Cockpit

### Phase 3 — live configuration integration

- [ ] Watch the Cockpit JSON file for external edits when practical
- [ ] Refresh the UI safely after external configuration changes
- [ ] Avoid overwriting unsaved modal input when a file change arrives
- [ ] Surface external-file parse/read failures clearly

### Phase 4 — runtime and UX hardening

- [ ] Improve modal-local write error feedback
- [ ] Review whole-card navigation semantics for middle-click/Ctrl-click/right-click behavior
- [ ] Expand automated runtime/integration coverage where Cockpit tooling allows
- [ ] Re-run administrator and non-administrator smoke tests
- [ ] Verify light/dark/auto themes and responsive layouts

### Deferred by design

- Generic service health checks remain deferred because arbitrary browser-side checks are unreliable across CORS, authentication, mixed-content restrictions, and self-signed TLS.
- Arbitrary uploaded image icons remain deferred because they require a secure file persistence/serving design beyond the lightweight JSON-only model.
- Localization/i18n remains optional until the project has enough users/translations to justify the maintenance cost.

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

Bookmark drag-and-drop and Move up / Move down operate within a group. Moving a bookmark between groups is done by editing its Group field.

### Configuration history

History is stored in the same JSON configuration file and is capped at 10 snapshots. This preserves the no-database/no-daemon architecture but can increase configuration size for very large collections.

See `RELEASING.md` for the release procedure.
