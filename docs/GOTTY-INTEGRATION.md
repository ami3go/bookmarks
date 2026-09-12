# GoTTY integration

Cockpit Bookmarks can recognize a running [GoTTY](https://github.com/sorenisanerd/gotty) web terminal during **Discover services**.

The integration is intentionally discovery/launch focused. Cockpit Bookmarks does not install GoTTY, start or stop it, change its command, proxy its WebSocket connection, or embed a shell inside Cockpit.

## Discovery behavior

Discovery still starts from host-local TCP listeners reported by `ss -H -ltnp`. When the listener process is identified as `gotty`, Bookmarks proposes a terminal-specific bookmark instead of a generic web-service bookmark:

- name: `GoTTY Terminal`
- group: `Terminal`
- icon: `⌨️`
- teal card accent
- tags: `GoTTY`, `terminal`, `web-terminal`, `discovered`, and the TCP port
- normal host-side availability checking
- normal new-tab opening behavior

When the GoTTY PID is visible, Bookmarks reads `/proc/<pid>/cmdline` through Cockpit and recognizes these options:

- `--path` / `-m`: appends the configured GoTTY base path
- `--tls` / `-t`: uses `https://` even on a non-standard port
- `--credential` / `-c`: reports that Basic Authentication is enabled but does **not** retain the credential value
- `--permit-write` / `-w`: shows a warning that clients can send terminal input
- `--random-url` / `-r`: disables automatic addition because the generated secret path cannot be reconstructed safely

The listening TCP port always comes from `ss`; Bookmarks does not trust a command-line port value over the actual socket.

If `/proc/<pid>/cmdline` cannot be read, discovery still recognizes GoTTY but marks the inferred URL as approximate and falls back to normal port-based HTTP/HTTPS inference.

## Security boundaries

GoTTY can expose a real terminal, so Bookmarks deliberately keeps a narrow integration boundary:

- credentials are never copied from the GoTTY process into bookmark JSON
- credentials discovered in `--credential` are never returned by the parser or shown in the UI
- `--permit-write` is never enabled or modified by Bookmarks
- random URL secrets are never guessed or reconstructed
- loopback-only GoTTY listeners keep the existing loopback warning and are not selected automatically
- GoTTY is opened as a normal external web application; it is not embedded in a Cockpit iframe/modal

A discovered bookmark stores only non-secret metadata such as:

```json
{
  "integration": "gotty"
}
```

The existing bookmark actions — Open in new tab, Copy URL, and Show QR code — operate on the bookmark URL that the administrator reviewed and saved.

## Recommended GoTTY deployment

For a terminal that accepts keyboard input, use GoTTY's authentication/TLS controls and restrict network exposure appropriately. For example, a loopback-only GoTTY instance can be placed behind an authenticated reverse proxy, or GoTTY can use its own TLS and authentication options.

GoTTY's own documentation warns that `--permit-write` grants clients interactive input and that traffic is unencrypted unless TLS is enabled.

## Limitations

GoTTY settings may also come from its config file or environment. v1 of this integration only inspects command-line flags when a PID is visible. Always review the generated URL in the discovery dialog before adding it.

`--random-url` instances must be bookmarked manually using the final URL shown by GoTTY.
