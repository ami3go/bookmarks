#!/bin/sh
set -eu

VERSION="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n 1)"
DEB_REVISION="${DEB_REVISION:-3}"
DEB_VERSION="${VERSION}-${DEB_REVISION}"
DEB="release/cockpit-bookmarks_${DEB_VERSION}_all.deb"
ARCHIVE="release/cockpit-bookmarks-${VERSION}.tar.gz"
METAINFO_REL="usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml"

fail() {
    echo "Debian package test failed: $*" >&2
    exit 1
}

sh -n packaging/local-apt-test.sh || fail "local APT test helper has invalid shell syntax"

test -s "$DEB" || fail "missing $DEB"
test -s "$ARCHIVE" || fail "missing $ARCHIVE"

[ "$(dpkg-deb -f "$DEB" Package)" = "cockpit-bookmarks" ] || fail "unexpected package name"
[ "$(dpkg-deb -f "$DEB" Version)" = "$DEB_VERSION" ] || fail "unexpected package version"
[ "$(dpkg-deb -f "$DEB" Architecture)" = "all" ] || fail "unexpected architecture"
[ "$(dpkg-deb -f "$DEB" Depends)" = "cockpit" ] || fail "unexpected Depends"
[ "$(dpkg-deb -f "$DEB" Recommends)" = "iproute2" ] || fail "unexpected Recommends"
[ "$(dpkg-deb -f "$DEB" Suggests)" = "cockpit-packagekit" ] || fail "unexpected Suggests"
[ "$(dpkg-deb -f "$DEB" Enhances)" = "cockpit" ] || fail "unexpected Enhances"

dpkg-deb --contents "$DEB" | grep -q 'usr/share/cockpit/cockpit-bookmarks/index.html$' || fail "missing Cockpit index.html"
dpkg-deb --contents "$DEB" | grep -q 'usr/share/cockpit/cockpit-bookmarks/manifest.json$' || fail "missing Cockpit manifest"
dpkg-deb --contents "$DEB" | grep -q 'usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml$' || fail "missing AppStream metadata"
dpkg-deb --contents "$DEB" | grep -q 'usr/share/doc/cockpit-bookmarks/examples/cockpit-bookmarks.json$' || fail "missing default config example"

ROOT="$(mktemp -d)"
MIGRATION_ROOT="$(mktemp -d)"
PREBUILT_ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT" "$MIGRATION_ROOT" "$PREBUILT_ROOT"' EXIT HUP INT TERM

dpkg-deb -R "$DEB" "$ROOT"
METAINFO="$ROOT/$METAINFO_REL"
test -s "$METAINFO" || fail "AppStream metadata was not extracted"
grep -Fq '<component type="addon">' "$METAINFO" || fail "AppStream component is not an addon"
grep -Fq '<id>io.github.ami3go.cockpit_bookmarks</id>' "$METAINFO" || fail "unexpected AppStream component ID"
grep -Fq '<extends>org.cockpit_project.cockpit</extends>' "$METAINFO" || fail "AppStream component does not extend Cockpit"
grep -Fq '<launchable type="cockpit-manifest">cockpit-bookmarks</launchable>' "$METAINFO" || fail "AppStream launchable does not match Cockpit package"

COCKPIT_BOOKMARKS_ROOT="$ROOT" sh "$ROOT/DEBIAN/postinst" configure
CONFIG="$ROOT/etc/cockpit/cockpit-bookmarks.json"
test -s "$CONFIG" || fail "postinst did not create config"

printf '%s\n' '{"title":"Preserve me","services":[]}' > "$CONFIG"
BEFORE="$(sha256sum "$CONFIG" | cut -d' ' -f1)"
COCKPIT_BOOKMARKS_ROOT="$ROOT" sh "$ROOT/DEBIAN/postinst" configure
AFTER="$(sha256sum "$CONFIG" | cut -d' ' -f1)"
[ "$BEFORE" = "$AFTER" ] || fail "postinst overwrote existing config"

COCKPIT_BOOKMARKS_ROOT="$ROOT" sh "$ROOT/DEBIAN/postrm" remove
test -s "$CONFIG" || fail "remove deleted user config"
COCKPIT_BOOKMARKS_ROOT="$ROOT" sh "$ROOT/DEBIAN/postrm" purge
test ! -e "$CONFIG" || fail "purge did not delete user config"

dpkg-deb -R "$DEB" "$MIGRATION_ROOT"
mkdir -p "$MIGRATION_ROOT/etc/cockpit"
printf '%s\n' '{"title":"Legacy config","services":[]}' > "$MIGRATION_ROOT/etc/cockpit/local-services.json"
COCKPIT_BOOKMARKS_ROOT="$MIGRATION_ROOT" sh "$MIGRATION_ROOT/DEBIAN/postinst" configure
cmp -s "$MIGRATION_ROOT/etc/cockpit/local-services.json" "$MIGRATION_ROOT/etc/cockpit/cockpit-bookmarks.json" || fail "legacy config was not migrated"

tar -xzf "$ARCHIVE" -C "$PREBUILT_ROOT"
SOURCE_ROOT="$PREBUILT_ROOT/cockpit-bookmarks-${VERSION}"
OUTPUT_DIR="$PREBUILT_ROOT/output"
env PATH=/usr/bin:/bin make -C "$SOURCE_ROOT" RELEASE_DIR="$OUTPUT_DIR" DEB_REVISION="$DEB_REVISION" deb-prebuilt
PREBUILT_DEB="$OUTPUT_DIR/cockpit-bookmarks_${DEB_VERSION}_all.deb"
test -s "$PREBUILT_DEB" || fail "Node-free prebuilt Debian build failed"
[ "$(dpkg-deb -f "$PREBUILT_DEB" Version)" = "$DEB_VERSION" ] || fail "prebuilt Debian package has wrong version"
dpkg-deb --contents "$PREBUILT_DEB" | grep -q 'usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml$' || fail "prebuilt Debian package is missing AppStream metadata"

echo "Debian package checks passed: $DEB"
