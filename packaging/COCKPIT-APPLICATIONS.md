# Cockpit Applications integration

The Debian package installs AppStream metainfo at:

```text
/usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml
```

The component is declared as a Cockpit add-on and launches the Cockpit package named `cockpit-bookmarks`.

With `cockpit-packagekit` installed, Cockpit's **Applications** page watches `/usr/share/metainfo` for installed add-ons. A locally installed `cockpit-bookmarks` Debian package can therefore appear as an installed Cockpit Application, and Cockpit can identify the owning Debian package when **Remove** is selected.

On Debian/Ubuntu, install the integration UI if necessary:

```bash
sudo apt install cockpit-packagekit
```

Then install or upgrade Cockpit Bookmarks with its Debian package:

```bash
sudo apt install ./cockpit-bookmarks_0.5.0-2_all.deb
```

Reload Cockpit and open **Applications**. If the page is already open, use its refresh action or reload the Cockpit session.

## Install and update buttons

A standalone `.deb` installed from a GitHub Release is known to the local package database, so the installed application can be displayed and removed. However, Cockpit cannot offer one-click installation or future updates for a package that is not available from one of the host's configured package repositories.

For **Install** and **Update** to work from Cockpit Applications, publish `cockpit-bookmarks` through an APT repository and generate repository AppStream catalog metadata containing this component and its package name.

## Verification

After installing the package, these commands should succeed:

```bash
test -f /usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml
dpkg -S /usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml
```

The Cockpit launchable in the metainfo file must remain:

```xml
<launchable type="cockpit-manifest">cockpit-bookmarks</launchable>
```
