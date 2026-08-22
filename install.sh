#!/bin/sh
set -eu

PACKAGE_NAME="local-services"
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="/usr/local/share/cockpit/$PACKAGE_NAME"
CONFIG_DIR="/etc/cockpit"
CONFIG_FILE="$CONFIG_DIR/local-services.json"

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
  install -m 0644 "$SOURCE_DIR/examples/services.json" "$CONFIG_FILE"
  echo "Created example configuration: $CONFIG_FILE"
else
  echo "Keeping existing configuration: $CONFIG_FILE"
fi

if command -v cockpit-bridge >/dev/null 2>&1; then
  echo
  echo "Cockpit package check:"
  cockpit-bridge --packages 2>/dev/null | grep -F "$PACKAGE_NAME" || true
fi

echo
echo "Installed Cockpit Local Services in $INSTALL_DIR"
echo "Edit $CONFIG_FILE, then reload Cockpit in your browser."
