# Cockpit Bookmarks roadmap

## v0.4.0 — management release

Status: merged to `main`. Local helper tests and JavaScript/JSX syntax checks passed; full npm/esbuild and Cockpit smoke testing are still pending.

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

### Phase 6 — maintainability

- [x] Move pure bookmark/configuration logic into `src/bookmarks.js`
- [x] Add dependency-free Node tests
- [x] Keep the installed application static
- [x] Keep JSON as the only persistent storage
- [x] Avoid Docker, a database, a daemon, or an API server

## Verification before release

- [x] JavaScript/JSX syntax review
- [x] Unit tests added for pure configuration logic
- [x] Run the helper test suite locally (9/9 passing)
- [ ] Run `npm test` from a fresh checkout
- [ ] Run `make clean && make` with npm registry access
- [ ] Install with `sudo make install install-config`
- [ ] Smoke-test add/edit/delete/reorder/import/restore in Cockpit
- [ ] Check responsive layout on desktop and narrow/mobile widths

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

- prebuilt release archive so production machines do not need Node/npm
- GitHub Actions build/test workflow
- committed `package-lock.json` for reproducible builds
- optional group ordering controls
- optional compact/list display mode
- localization/i18n if the project grows beyond personal/community use
