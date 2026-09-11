#!/bin/sh
set -eu

REPO_DIR="${COCKPIT_BOOKMARKS_APT_TEST_DIR:-/var/local/cockpit-bookmarks-apt}"
SOURCE_FILE="${COCKPIT_BOOKMARKS_APT_TEST_SOURCE:-/etc/apt/sources.list.d/cockpit-bookmarks-test.list}"

usage() {
    cat >&2 <<'EOF'
Usage:
  sudo sh packaging/local-apt-test.sh install /path/to/cockpit-bookmarks_VERSION_all.deb
  sudo sh packaging/local-apt-test.sh remove

This helper creates a local, trusted file:// APT source strictly for testing the
Cockpit Bookmarks update notification. Do not use this layout as a production
repository.
EOF
    exit 2
}

[ "$(id -u)" -eq 0 ] || {
    echo "Run this helper as root (for example with sudo)." >&2
    exit 1
}

ACTION="${1:-}"
case "$ACTION" in
    install)
        [ "$#" -eq 2 ] || usage
        DEB="$2"
        [ -s "$DEB" ] || {
            echo "Debian package not found: $DEB" >&2
            exit 1
        }
        command -v apt-ftparchive >/dev/null 2>&1 || {
            echo "apt-ftparchive is required. Install it with: sudo apt install apt-utils" >&2
            exit 1
        }

        install -d -m 0755 "$REPO_DIR"
        find "$REPO_DIR" -maxdepth 1 -type f -name 'cockpit-bookmarks_*.deb' -delete
        install -m 0644 "$DEB" "$REPO_DIR/$(basename "$DEB")"

        (
            cd "$REPO_DIR"
            apt-ftparchive packages . > Packages
            gzip -9n -c Packages > Packages.gz
            chmod 0644 Packages Packages.gz
        )

        printf 'deb [trusted=yes] file:%s ./\n' "$REPO_DIR" > "$SOURCE_FILE"
        chmod 0644 "$SOURCE_FILE"

        apt-get update
        echo
        echo "Local Cockpit Bookmarks APT test source enabled."
        apt-cache policy cockpit-bookmarks
        ;;
    remove)
        [ "$#" -eq 1 ] || usage
        rm -f "$SOURCE_FILE"
        rm -rf "$REPO_DIR"
        apt-get update
        echo "Local Cockpit Bookmarks APT test source removed."
        ;;
    *)
        usage
        ;;
esac
