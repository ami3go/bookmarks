import { gottyListenerPids, parseGoTTYCommandLine } from './discovery.js';

export const GOTTY_REDACTION_SCRIPT = String.raw`
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
        --credential=*|-c=*)
            printf '%s\0' "${arg%%=*}=<redacted>"
            ;;
        *)
            printf '%s\0' "$arg"
            ;;
    esac
done < "$cmdline"
`;

export async function inspectGoTTYListenersSafely(cockpit, listeners, socketOutput) {
    const pidsByPort = gottyListenerPids(socketOutput);
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
                reason: 'GoTTY process arguments are not visible to this user.',
            };
            return;
        }

        try {
            const commandLine = await cockpit.spawn(
                ['bash', '-c', GOTTY_REDACTION_SCRIPT, 'bash', String(pid)],
                { superuser: 'try', err: 'message' }
            );
            result[port] = parseGoTTYCommandLine(commandLine);
        } catch (_) {
            result[port] = {
                inspected: false,
                reason: 'GoTTY process arguments could not be inspected safely.',
            };
        }
    }));

    return result;
}
