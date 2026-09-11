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

## Update notifications inside Cockpit Bookmarks

Cockpit Bookmarks checks the host's local APT policy when the page loads. It reads the installed and candidate versions for the `cockpit-bookmarks` package and uses Debian's own `dpkg --compare-versions` semantics to decide whether the candidate is newer.

When a newer installable candidate exists, the page shows a non-blocking notification with the installed and candidate versions. **Open Software Updates** uses Cockpit's supported cross-component navigation API to open the Software Updates page.

The check is deliberately local and lightweight:

- no daemon or timer is installed
- no GitHub API request is made from the browser
- no package metadata refresh is forced
- non-Debian hosts, missing APT tools, and unmanaged/source installs fail silently

The notification reflects the package metadata currently known to APT. Run `sudo apt update`, or use Cockpit Software Updates' refresh action, when repository metadata needs refreshing.

## Install and update buttons

A standalone `.deb` installed from a GitHub Release is known to the local package database, so the installed application can be displayed and removed. However, Cockpit cannot offer one-click installation or future updates for a package that is not available from one of the host's configured package repositories.

The same rule applies to the in-page update notification: an update is announced only when APT reports a newer candidate version. A newer GitHub Release by itself is not enough.

For **Install**, **Update**, and automatic update availability to work through Cockpit, publish `cockpit-bookmarks` through an APT repository and generate repository AppStream catalog metadata containing this component and its package name.

## Verification

After installing the package, these commands should succeed:

```bash
test -f /usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml
dpkg -S /usr/share/metainfo/io.github.ami3go.cockpit_bookmarks.metainfo.xml
```

To see what the in-page update check sees:

```bash
apt-cache policy cockpit-bookmarks
```

For example, an update is available when the output contains different versions such as:

```text
Installed: 0.5.0-2
Candidate: 0.5.1-1
```

The Cockpit launchable in the metainfo file must remain:

```xml
<launchable type="cockpit-manifest">cockpit-bookmarks</launchable>
```
