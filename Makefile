PACKAGE_NAME := cockpit-bookmarks
PREFIX ?= /usr/local
CONFIG_DIR ?= /etc/cockpit
CONFIG_FILE := $(CONFIG_DIR)/cockpit-bookmarks.json
LEGACY_CONFIG_FILE := $(CONFIG_DIR)/local-services.json
VERSION := $(shell sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n 1)
DEB_REVISION ?= 3
RELEASE_DIR := release
RELEASE_NAME := $(PACKAGE_NAME)-$(VERSION)
RELEASE_ARCHIVE := $(RELEASE_DIR)/$(RELEASE_NAME).tar.gz
RELEASE_DEB := $(RELEASE_DIR)/$(PACKAGE_NAME)_$(VERSION)-$(DEB_REVISION)_all.deb
SRC_FILES := $(shell find src -type f -print)
SRC_DIRS := $(shell find src -type d -print)

.PHONY: all dist watch install install-prebuilt install-config devel-install devel-uninstall uninstall clean release deb deb-prebuilt release-all

all: dist

node_modules/.package-lock.json: package.json package-lock.json
	npm ci --no-audit --no-fund

dist: node_modules/.package-lock.json build.js $(SRC_FILES) $(SRC_DIRS)
	NODE_ENV=$(NODE_ENV) npm run build

watch: node_modules/.package-lock.json
	npm run watch

install: dist
	install -d "$(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)"
	cp -r dist/* "$(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)/"

install-prebuilt:
	@test -s dist/index.html || { echo "Missing prebuilt dist/. Use 'make install' from a source checkout." >&2; exit 1; }
	install -d "$(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)"
	cp -r dist/* "$(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)/"

install-config:
	install -d "$(DESTDIR)$(CONFIG_DIR)"
	@if [ ! -e "$(DESTDIR)$(CONFIG_FILE)" ]; then \
		if [ -e "$(DESTDIR)$(LEGACY_CONFIG_FILE)" ]; then \
			cp -p "$(DESTDIR)$(LEGACY_CONFIG_FILE)" "$(DESTDIR)$(CONFIG_FILE)"; \
			echo "Migrated $(DESTDIR)$(LEGACY_CONFIG_FILE) -> $(DESTDIR)$(CONFIG_FILE)"; \
		else \
			install -m 0644 examples/cockpit-bookmarks.json "$(DESTDIR)$(CONFIG_FILE)"; \
			echo "Created $(DESTDIR)$(CONFIG_FILE)"; \
		fi; \
	else \
		echo "Keeping existing $(DESTDIR)$(CONFIG_FILE)"; \
	fi

devel-install: dist
	mkdir -p "$$HOME/.local/share/cockpit"
	ln -sfn "$(CURDIR)/dist" "$$HOME/.local/share/cockpit/$(PACKAGE_NAME)"

devel-uninstall:
	rm -f "$$HOME/.local/share/cockpit/$(PACKAGE_NAME)"

uninstall:
	rm -rf "$(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)"

release: clean
	NODE_ENV=production $(MAKE) dist
	rm -rf "$(RELEASE_DIR)/$(RELEASE_NAME)"
	mkdir -p "$(RELEASE_DIR)/$(RELEASE_NAME)"
	cp -r dist examples packaging "$(RELEASE_DIR)/$(RELEASE_NAME)/"
	cp Makefile package.json README.md ROADMAP.md CHANGELOG.md SECURITY.md LICENSE "$(RELEASE_DIR)/$(RELEASE_NAME)/"
	tar -C "$(RELEASE_DIR)" -czf "$(RELEASE_ARCHIVE)" "$(RELEASE_NAME)"
	rm -rf "$(RELEASE_DIR)/$(RELEASE_NAME)"
	@echo "Created $(RELEASE_ARCHIVE)"

deb:
	$(MAKE) clean
	NODE_ENV=production $(MAKE) dist
	$(MAKE) deb-prebuilt

deb-prebuilt:
	DEB_REVISION="$(DEB_REVISION)" RELEASE_DIR="$(RELEASE_DIR)" sh packaging/build-deb.sh
	@test -s "$(RELEASE_DEB)"

release-all:
	$(MAKE) release
	$(MAKE) deb-prebuilt

clean:
	rm -rf dist release
