#!/bin/sh
set -eu

PACKAGE_NAME="cockpit-bookmarks"
DEB_REVISION="${DEB_REVISION:-3}"
RELEASE_DIR="${RELEASE_DIR:-release}"
METAINFO_SOURCE="packaging/debian/io.github.ami3go.cockpit_bookmarks.metainfo.xml"
METAINFO_NAME="io.github.ami3go.cockpit_bookmarks.metainfo.xml"

VERSION="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n 1)"
if [ -z "$VERSION" ]; then
    echo "Could not determine version from package.json" >&2
    exit 1
fi

case "$DEB_REVISION" in
    *[!0-9A-Za-z.+~]*|'')
        echo "Invalid Debian revision: $DEB_REVISION" >&2
        exit 1
        ;;
esac

command -v dpkg-deb >/dev/null 2>&1 || {
    echo "dpkg-deb is required to build the Debian package." >&2
    exit 1
}

for required in dist/index.html dist/index.css dist/index.js dist/manifest.json examples/cockpit-bookmarks.json "$METAINFO_SOURCE"; do
    test -s "$required" || {
        echo "Missing prebuilt file: $required" >&2
        exit 1
    }
done

DEB_VERSION="${VERSION}-${DEB_REVISION}"
DEB_FILE="${RELEASE_DIR}/${PACKAGE_NAME}_${DEB_VERSION}_all.deb"
BUILD_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/${PACKAGE_NAME}-deb.XXXXXX")"
trap 'rm -rf "$BUILD_ROOT"' EXIT HUP INT TERM

PLUGIN_DIR="$BUILD_ROOT/usr/share/cockpit/$PACKAGE_NAME"
DOC_DIR="$BUILD_ROOT/usr/share/doc/$PACKAGE_NAME"
METAINFO_DIR="$BUILD_ROOT/usr/share/metainfo"
CONTROL_DIR="$BUILD_ROOT/DEBIAN"

install -d -m 0755 "$PLUGIN_DIR" "$DOC_DIR/examples" "$METAINFO_DIR" "$CONTROL_DIR"
cp -a dist/. "$PLUGIN_DIR/"
find "$PLUGIN_DIR" -type d -exec chmod 0755 {} +
find "$PLUGIN_DIR" -type f -exec chmod 0644 {} +

install -m 0644 "$METAINFO_SOURCE" "$METAINFO_DIR/$METAINFO_NAME"
install -m 0644 examples/cockpit-bookmarks.json "$DOC_DIR/examples/cockpit-bookmarks.json"
install -m 0644 README.md "$DOC_DIR/README.md"
install -m 0644 LICENSE "$DOC_DIR/copyright"
gzip -9n -c CHANGELOG.md > "$DOC_DIR/changelog.gz"
chmod 0644 "$DOC_DIR/changelog.gz"

install -m 0755 packaging/debian/postinst "$CONTROL_DIR/postinst"
install -m 0755 packaging/debian/postrm "$CONTROL_DIR/postrm"

INSTALLED_SIZE="$(du -sk "$BUILD_ROOT/usr" | awk '{print $1}')"
sed \
    -e "s/@VERSION@/$DEB_VERSION/g" \
    -e "s/@INSTALLED_SIZE@/$INSTALLED_SIZE/g" \
    packaging/debian/control.in > "$CONTROL_DIR/control"
chmod 0644 "$CONTROL_DIR/control"

(
    cd "$BUILD_ROOT"
    find usr -type f -print0 | sort -z | xargs -0 md5sum
) > "$CONTROL_DIR/md5sums"
chmod 0644 "$CONTROL_DIR/md5sums"

mkdir -p "$RELEASE_DIR"
dpkg-deb --root-owner-group --build "$BUILD_ROOT" "$DEB_FILE" >/dev/null

echo "Created $DEB_FILE"
