#!/bin/sh
set -eu

INSTALL_DIR="/usr/local/share/cockpit/cockpit-bookmarks"
LEGACY_INSTALL_DIR="/usr/local/share/cockpit/local-services"
CONFIG_FILE="/etc/cockpit/cockpit-bookmarks.json"
LEGACY_CONFIG_FILE="/etc/cockpit/local-services.json"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this uninstaller as root, for example: sudo sh uninstall.sh" >&2
  exit 1
fi

rm -rf -- "$INSTALL_DIR" "$LEGACY_INSTALL_DIR"
echo "Removed Cockpit Bookmarks package files."
echo "Configuration was kept at $CONFIG_FILE"
if [ -e "$LEGACY_CONFIG_FILE" ]; then
  echo "Legacy configuration was also kept at $LEGACY_CONFIG_FILE"
fi
echo "Remove configuration files manually if you no longer need them."
