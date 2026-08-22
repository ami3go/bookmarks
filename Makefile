PACKAGE_NAME := cockpit-bookmarks
PREFIX ?= /usr/local
CONFIG_DIR ?= /etc/cockpit
CONFIG_FILE := $(CONFIG_DIR)/cockpit-bookmarks.json

.PHONY: all dist watch install install-config devel-install devel-uninstall uninstall clean

all: dist

dist: package.json build.js $(wildcard src/*)
	@test -d node_modules || npm install --ignore-scripts --no-audit --no-fund
	NODE_ENV=$(NODE_ENV) npm run build

watch:
	@test -d node_modules || npm install --ignore-scripts --no-audit --no-fund
	npm run watch

install: dist
	install -d "$(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)"
	cp -r dist/* "$(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)/"

install-config:
	install -d "$(DESTDIR)$(CONFIG_DIR)"
	@if [ ! -e "$(DESTDIR)$(CONFIG_FILE)" ]; then \
		install -m 0644 examples/cockpit-bookmarks.json "$(DESTDIR)$(CONFIG_FILE)"; \
		echo "Created $(DESTDIR)$(CONFIG_FILE)"; \
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

clean:
	rm -rf dist
