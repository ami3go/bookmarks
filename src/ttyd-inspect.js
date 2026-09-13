import { parseTtydCommandLine, ttydListenerPids } from './ttyd-discovery.js';

// ttyd accepts Basic Auth credentials through -c/--credential. Redact the
// value on the host before the process command line crosses Cockpit's spawn
// boundary, matching the existing GoTTY credential-safety model.
export const TTYD_REDACTION_SCRIPT = String.raw`
set -eu
pid="$1"
cmdline="/proc/$pid/cmdline"
[ -r "$cmdline" ] || exit 1
skip_credential=0
while IFS= read -r -d '' arg; do
    if [ "$skip_credential" -eq 1 ]; then
        printf '%s\0' '<redacted>'
        skip_credential=0
        continue
    fi

    case "$arg" in
        --credential|-c)
            printf '%s\0' "$arg"
            skip_credential=1
            ;;
        --credential=*)
            printf '%s\0' '--credential=<redacted>'
            ;;
        -c=*)
            printf '%s\0' '-c=<redacted>'
            ;;
        *)
            printf '%s\0' "$arg"
            ;;
    esac
done < "$cmdline"
`;

export async function inspectTtydListenersSafely(cockpit, listeners, socketOutput) {
    const pidsByPort = ttydListenerPids(socketOutput);
    const result = {};
    const listenerPorts = new Set((listeners || []).map(listener => listener.port));

    await Promise.all(Object.entries(pidsByPort).map(async ([portText, pids]) => {
        const port = Number(portText);
        if (!listenerPorts.has(port))
            return;

        const pid = pids?.[0];
        if (!Number.isInteger(pid) || pid < 1) {
            result[port] = {
                inspected: false,
                reason: 'ttyd process arguments are not visible to this user.',
            };
            return;
        }

        try {
            const commandLine = await cockpit.spawn(
                ['bash', '-c', TTYD_REDACTION_SCRIPT, 'bash', String(pid)],
                { superuser: 'try', err: 'message' }
            );
            result[port] = parseTtydCommandLine(commandLine);
        } catch (_) {
            result[port] = {
                inspected: false,
                reason: 'ttyd process arguments could not be inspected safely.',
            };
        }
    }));

    return result;
}
