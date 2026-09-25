# Security policy

## Supported versions

Security fixes are provided for the latest released version of Cockpit Bookmarks. Older releases should be upgraded before reporting an issue unless the report is specifically about an upgrade or migration vulnerability.

| Version | Supported |
| --- | --- |
| 0.7.x | Yes |
| < 0.7 | No |

## Reporting a vulnerability

Please do not disclose a security-sensitive issue in a public issue.

Use GitHub's **Report a vulnerability** / private security advisory flow for this repository when it is available. If private vulnerability reporting is not available, contact the repository owner privately through GitHub before publishing technical details.

Please include:

- the affected Cockpit Bookmarks version or commit;
- the Cockpit and operating-system versions;
- a concise description of the impact;
- reproduction steps or a minimal proof of concept;
- any suggested mitigation, if known.

## Security model

Cockpit Bookmarks is delivered as a static Cockpit extension and does not run an always-on application daemon, API server, database, or authentication service of its own. Optional terminal and application launchers do create transient **per-user systemd services** on demand. Those processes run with the privileges of the Cockpit user who starts them and remain subject to that user's systemd manager and the launcher's configured timeout.

Configuration is stored in `/etc/cockpit/cockpit-bookmarks.json`. UI changes require Cockpit administrator privileges and are written through Cockpit's privileged file API. Bookmark URLs are restricted to `http://` and `https://` targets.

Launcher configuration is executable configuration: terminal provider binaries, application commands, arguments, bind addresses, ports, and timeouts are used when a user starts a launcher. Imported configurations therefore display launcher commands before import and require an explicit trust confirmation. Do not import launcher configuration from an untrusted source.

Service discovery runs host commands through the Cockpit bridge to inspect local listening TCP sockets. GoTTY and ttyd process inspection reduces `/proc/<pid>/cmdline` to security facts on the host; credential values and arbitrary argv are not returned to the browser. Discovery does not scan the LAN and never starts discovered services.

Launcher output is written to a private per-user runtime directory under `/run/user/<uid>/cockpit-bookmarks/` and is cleared with the user's runtime directory. It is intentionally not persisted in the shared bookmark configuration.

Do not store passwords, API tokens, session keys, private keys, or other secrets in bookmark or launcher configuration. In particular, command-line credentials can be visible to other sufficiently privileged/local processes through the operating system even when Cockpit Bookmarks does not copy them into the browser.

### Terminal-launcher exposure

Terminal launchers are remote shell access. Review their listen address, write mode, authentication provided by the terminal server, and auto-stop setting before starting them. A launcher bound beyond loopback can be reachable by other machines according to host routing and firewall rules. The plugin does not replace host firewalling, TLS termination, or authentication controls.
