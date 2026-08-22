# Cockpit Bookmarks roadmap

## v0.4.0 — management release

Status: feature implementation is on `main`; release engineering is being finalized on `release-hardening`. Reproducible install, unit tests, production build, prebuilt packaging, Node-free artifact installation, and uninstall/config-preservation checks pass in GitHub Actions. A real Cockpit runtime smoke test remains before tagging the release.

### Phase 1 — safer editing

- [x] Keep Add available to administrators
- [x] Lock Edit/Delete behind the pencil edit-mode toggle
- [x] Auto-lock edit mode after two minutes of inactivity
- [x] Keep delete confirmation as a second safety layer
- [x] Preserve read-only browsing for non-admin users

### Phase 2 — organization and ordering

- [x] Render bookmarks in group sections
- [x] Add group filtering
- [x] Suggest existing groups in the editor
- [x] Add drag-and-drop ordering within a group
- [x] Add accessible Move up / Move down controls
- [x] Preserve ordering in the JSON configuration

### Phase 3 — page customization

- [x] Edit title
- [x] Edit subtitle
- [x] Edit eyebrow text
- [x] Allow the eyebrow to be hidden

### Phase 4 — portability and recovery

- [x] Export configuration to JSON
- [x] Import configuration from JSON
- [x] Validate imports before writing
- [x] Confirm before replacing the active configuration
- [x] Keep up to 10 automatic configuration snapshots
- [x] Restore a previous snapshot from the UI

### Phase 5 — editor quality

- [x] Warn about duplicate bookmark names
- [x] Warn about duplicate bookmark URLs
- [x] Preview the resolved `{host}` URL
- [x] Add an emoji/service icon picker
- [x] Keep custom icon input
- [x] Add searchable tags as optional metadata
- [x] Improve first-run and no-results empty states

### Phase 6 — maintainability and release engineering

- [x] Move pure bookmark/configuration logic into `src/bookmarks.js`
- [x] Add dependency-free Node tests
- [x] Commit `package-lock.json` for reproducible installs
- [x] Use `npm ci` for deterministic builds
- [x] Add GitHub Actions test/build/package CI
- [x] Build a precompiled release tarball
- [x] Verify prebuilt installation without Node.js in `PATH`
- [x] Verify uninstall preserves system configuration
- [x] Add changelog, security policy, and release procedure
- [x] Replace the previously adapted theme helper with an independently written MIT implementation
- [x] Keep the installed application static
- [x] Keep JSON as the only persistent storage
- [x] Avoid Docker, a database, a daemon, or an API server

## Verification before release

### Automated

- [x] Unit test suite passes from a clean CI checkout
- [x] `npm ci` succeeds from the committed lockfile
- [x] Production esbuild bundle succeeds
- [x] Expected `dist/` files are present and production source maps are absent
- [x] Release tarball is generated and its required contents are checked
- [x] Prebuilt archive installs with Node.js removed from `PATH`
- [x] Uninstall removes the plugin while preserving `/etc/cockpit/cockpit-bookmarks.json`
- [x] Reinstall keeps an existing configuration unchanged

### Real Cockpit host

- [ ] Install the CI-produced prebuilt tarball on a real Cockpit host
- [ ] Record Cockpit and operating-system versions used for the release smoke test
- [ ] Smoke-test card opening, search, and group filtering
- [ ] Smoke-test add/edit/delete and edit-mode locking
- [ ] Smoke-test drag and keyboard reorder controls
- [ ] Smoke-test page settings, import/export, and history restore
- [ ] Verify a non-administrator account remains read-only
- [ ] Check light/dark/auto theme behavior
- [ ] Check desktop and narrow/mobile layouts

See `RELEASING.md` for the complete release procedure.

## Known constraints

### Service reachability

`{host}` substitutes the hostname or IP used to open Cockpit. It does not expose services bound only to `127.0.0.1`.

### Reordering

Drag-and-drop and Move up / Move down operate within a group. Moving a bookmark between groups is done by editing its Group field. This avoids ambiguous cross-group drag behavior.

### Configuration history

History is stored in the same JSON configuration file and is capped at 10 snapshots. This avoids a new database or background service, but very large bookmark collections can increase configuration size.

### Service health checks

Deferred. Browser-side health checks are not reliable for arbitrary services because of CORS, authentication, mixed-content restrictions, and self-signed TLS certificates.

### Uploaded image icons

Deferred. The current icon field supports emoji and text. Uploading arbitrary files would require deciding where Cockpit should persist, secure, and serve those files, which is outside the lightweight JSON-only model.

## Possible post-v0.4 work

- optional explicit group ordering controls
- optional compact/list display mode
- localization/i18n if the project grows beyond personal/community use
- broader automated Cockpit runtime/integration coverage if the project gains multiple supported distro targets
