# Releasing Cockpit Bookmarks

This checklist is the release gate for Cockpit Bookmarks.

## 1. Prepare the source tree

- Update the version in `package.json`.
- Update `CHANGELOG.md` with the release date and notable changes.
- Confirm `ROADMAP.md` reflects the actual implementation state.
- Commit all changes and open or update the release pull request.

## 2. Automated gate

The GitHub Actions `CI` workflow must pass on the release commit.

CI verifies:

- reproducible dependency installation with `npm ci`;
- unit tests;
- production bundle generation;
- expected `dist/` files and absence of source maps;
- release tarball generation and contents;
- prebuilt installation with Node.js deliberately removed from `PATH`;
- uninstall behavior;
- preservation of `/etc/cockpit/cockpit-bookmarks.json` across uninstall/reinstall;
- upload of the production bundle and release archive as workflow artifacts.

Do not release from a commit with a failing or incomplete CI run.

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
- A bookmark card opens its service in a new tab.
- Search and group filtering work.
- `{host}` resolves to the Cockpit hostname/IP as expected.
- Add creates a bookmark and persists after reload.
- Pencil edit mode is off by default.
- Edit and Delete are disabled until edit mode is enabled.
- Edit updates a bookmark and persists after reload.
- Delete requires confirmation and persists after reload.
- Drag reorder and Move up/Move down persist correctly.
- Page settings persist.
- JSON export downloads a valid configuration.
- JSON import validates and applies a configuration.
- Configuration history can restore a previous state.
- A non-administrator account can browse/open bookmarks but cannot modify configuration.

## 4. Upgrade and uninstall checks

On the test host, preserve a customized configuration and run:

```bash
sudo make uninstall
sudo make install-prebuilt install-config
```

Confirm `/etc/cockpit/cockpit-bookmarks.json` was not deleted or replaced.

## 5. Finalize

After the runtime smoke test passes:

- merge the release-hardening pull request;
- confirm CI passes on `main`;
- create an annotated `v<version>` tag on the tested commit;
- create the GitHub release from that exact tag;
- attach the CI-produced `cockpit-bookmarks-<version>.tar.gz` artifact;
- publish the matching `CHANGELOG.md` section as release notes.

For a public release, also confirm `SECURITY.md`, license metadata, repository visibility, and README screenshots are ready before announcing the release.
