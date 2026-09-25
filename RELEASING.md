# Releasing Cockpit Bookmarks

This checklist is the release gate for Cockpit Bookmarks.

## 1. Prepare the source tree

- Update the version in `package.json` and `package-lock.json` together.
- Move the intended release notes out of `[Unreleased]` in `CHANGELOG.md`, using the same version and release date.
- Confirm `ROADMAP.md` reflects the actual implementation state.
- Commit all changes and open or update the release pull request.

## 2. Automated gate

Both the GitHub Actions **CI** and **CodeQL** workflows must pass on the release commit.

CI verifies:

- reproducible dependency installation with `npm ci`;
- React Hooks lint rules;
- unused file/export checks with knip;
- unit, component, orchestration, and axe accessibility regression tests;
- production bundle generation;
- expected `dist/` files and absence of source maps;
- release tarball and Debian package generation/contents;
- prebuilt installation with Node.js deliberately removed from `PATH`;
- uninstall behavior;
- preservation of `/etc/cockpit/cockpit-bookmarks.json` across uninstall/reinstall;
- upload of production/release artifacts for CI inspection.

Do not release from a commit with a failing or incomplete CI/CodeQL run.

## 3. Cockpit runtime smoke test

Use the prebuilt tarball produced by CI on a real Cockpit host.

Install:

```bash
tar -xzf cockpit-bookmarks-<version>.tar.gz
cd cockpit-bookmarks-<version>
sudo make install-prebuilt install-config
```

Record the host versions:

```bash
cockpit-bridge --version || cockpit-ws --version
cat /etc/os-release
```

Then verify in the browser:

- Bookmarks appears under Cockpit Tools.
- The page loads without browser-console errors.
- Light, dark, and automatic theme behavior are correct.
- A normal bookmark uses native browser link behavior, including new-tab/middle-click/context-menu actions.
- Search, group filtering, collapsed groups, and compact mode work.
- `{host}` resolves to the Cockpit hostname/IP as expected.
- Add/edit/delete/reorder changes persist after reload.
- Page-settings live preview cancels without losing the saved search query.
- JSON export downloads a valid configuration.
- JSON import validates and applies a configuration; launcher imports require explicit executable-command trust.
- Configuration history can restore a previous state.
- Discover services shows local candidates without exposing terminal credentials/argv in browser-visible data.
- Terminal/application launchers show state and Stop/Restart/View output actions.
- Launcher deletion stops the unit first and reports a failed stop before allowing Delete anyway.
- A non-administrator account can browse/open bookmarks but cannot modify configuration.

## 4. Upgrade and uninstall checks

On the test host, preserve a customized configuration and run:

```bash
sudo make uninstall
sudo make install-prebuilt install-config
```

Confirm `/etc/cockpit/cockpit-bookmarks.json` was not deleted or replaced.

## 5. Publish by tag

After the runtime smoke test passes:

1. merge the release pull request;
2. confirm CI and CodeQL pass on `main`;
3. create/push the annotated `v<version>` tag on that tested commit.

The tag automatically starts `.github/workflows/release.yml`. That workflow:

- checks that `v<version>` matches `package.json`;
- runs tests and rebuilds release artifacts from the tagged source;
- creates build-provenance attestations for the tarball and Debian package;
- computes SHA-256 checksum files;
- creates the GitHub release or safely fills missing assets on an existing matching release;
- refuses to publish changed application inputs under an already-existing version.

The workflow can also be started manually with `workflow_dispatch`, but the source version/tag invariants still apply.

For a public release, also confirm `SECURITY.md`, license metadata, repository visibility, release notes, and README documentation are ready before announcing the release.
