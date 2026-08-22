# Security policy

## Supported versions

Security fixes are provided for the latest released version of Cockpit Bookmarks.

| Version | Supported |
| --- | --- |
| 0.4.x | Yes |
| < 0.4 | No |

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

Cockpit Bookmarks is a static Cockpit extension. It does not run its own daemon, API server, database, or authentication system.

Configuration is stored in `/etc/cockpit/cockpit-bookmarks.json`. UI changes require Cockpit administrator privileges and are written through Cockpit's privileged file API. Bookmark URLs are restricted to `http://` and `https://` targets and open in a new tab.

Do not store passwords, API tokens, session keys, or other secrets in bookmark configuration.
