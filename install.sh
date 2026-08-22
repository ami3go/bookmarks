#!/bin/sh
set -eu

PACKAGE_NAME="cockpit-bookmarks"
LEGACY_PACKAGE_NAME="local-services"
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="/usr/local/share/cockpit/$PACKAGE_NAME"
LEGACY_INSTALL_DIR="/usr/local/share/cockpit/$LEGACY_PACKAGE_NAME"
CONFIG_DIR="/etc/cockpit"
CONFIG_FILE="$CONFIG_DIR/cockpit-bookmarks.json"
LEGACY_CONFIG_FILE="$CONFIG_DIR/local-services.json"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer as root, for example: sudo sh install.sh" >&2
  exit 1
fi

install -d -m 0755 "$INSTALL_DIR" "$CONFIG_DIR"
install -m 0644 \
  "$SOURCE_DIR/manifest.json" \
  "$SOURCE_DIR/index.html" \
  "$SOURCE_DIR/app.js" \
  "$SOURCE_DIR/style.css" \
  "$INSTALL_DIR/"

if [ ! -e "$CONFIG_FILE" ]; then
  if [ -e "$LEGACY_CONFIG_FILE" ]; then
    cp -p "$LEGACY_CONFIG_FILE" "$CONFIG_FILE"
    echo "Migrated configuration: $LEGACY_CONFIG_FILE -> $CONFIG_FILE"
  else
    install -m 0644 "$SOURCE_DIR/examples/services.json" "$CONFIG_FILE"
    echo "Created example configuration: $CONFIG_FILE"
  fi
else
  echo "Keeping existing configuration: $CONFIG_FILE"
fi

if [ -d "$LEGACY_INSTALL_DIR" ] && [ "$LEGACY_INSTALL_DIR" != "$INSTALL_DIR" ]; then
  rm -rf -- "$LEGACY_INSTALL_DIR"
  echo "Removed legacy Cockpit package: $LEGACY_INSTALL_DIR"
fi

if command -v cockpit-bridge >/dev/null 2>&1; then
  echo
  echo "Cockpit package check:"
  cockpit-bridge --packages 2>/dev/null | grep -F "$PACKAGE_NAME" || true
fi

echo
echo "Installed Cockpit Bookmarks in $INSTALL_DIR"
echo "Edit $CONFIG_FILE, then reload Cockpit in your browser."
