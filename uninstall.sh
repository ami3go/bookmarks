#!/bin/sh
set -eu

INSTALL_DIR="/usr/local/share/cockpit/local-services"
CONFIG_FILE="/etc/cockpit/local-services.json"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this uninstaller as root, for example: sudo sh uninstall.sh" >&2
  exit 1
fi

rm -rf -- "$INSTALL_DIR"
echo "Removed $INSTALL_DIR"
echo "Configuration was kept at $CONFIG_FILE"
echo "Remove it manually if you no longer need it."
