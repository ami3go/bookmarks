# End-to-end update notification test

This procedure tests Cockpit Bookmarks' update notification against a real APT
candidate without publishing a production APT repository.

The desired state is:

```text
Installed: 0.5.0-2
Candidate: 0.5.0-3
```

The local test repository is a trusted `file:` source and is intended only for
testing on the local machine.

## 1. Keep the packaged version at 0.5.0-2

Confirm the currently installed Debian package:

```bash
dpkg-query -W -f='${Version}\n' cockpit-bookmarks
```

It should report `0.5.0-2` for the cleanest test.

## 2. Load the newest plugin code without changing the dpkg version

From the source checkout:

```bash
git switch main
git pull --ff-only
npm ci
make clean
make
sudo make install
```

This installs the current Cockpit frontend under `/usr/local/share/cockpit/`
without replacing the Debian package database entry.

## 3. Build the newer candidate package

```bash
make deb
```

The default package revision is now `0.5.0-3`, producing:

```text
release/cockpit-bookmarks_0.5.0-3_all.deb
```

## 4. Enable the local APT test repository

The helper uses `apt-ftparchive`, provided by `apt-utils` on Debian/Ubuntu:

```bash
sudo apt install apt-utils
sudo sh packaging/local-apt-test.sh install "$PWD/release/cockpit-bookmarks_0.5.0-3_all.deb"
```

It copies the package into `/var/local/cockpit-bookmarks-apt`, generates
`Packages`/`Packages.gz`, writes
`/etc/apt/sources.list.d/cockpit-bookmarks-test.list`, and runs `apt-get update`.

Verify:

```bash
apt-cache policy cockpit-bookmarks
```

Expected result:

```text
Installed: 0.5.0-2
Candidate: 0.5.0-3
```

## 5. Test Cockpit

Reload Cockpit Bookmarks. The page should show an update notification for
`0.5.0-3` with an **Open Software Updates** action.

Opening Software Updates should show the same package update because both views
are backed by the host package manager.

If you install the update, reload Bookmarks afterward. The notification should
disappear because Installed and Candidate are both `0.5.0-3`.

## 6. Remove the test repository

```bash
sudo sh packaging/local-apt-test.sh remove
```

This removes only the temporary local APT source and repository directory. It
does not downgrade an already installed `0.5.0-3` package.
