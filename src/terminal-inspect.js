import { gottyListenerPids } from './discovery.js';
import { ttydListenerPids } from './ttyd-discovery.js';

export const TERMINAL_INSPECTION_SCRIPT = String.raw`
set -eu
provider="$1"
pid="$2"
case "$pid" in
    ''|*[!0-9]*) exit 2 ;;
esac
[ "$pid" -gt 0 ] || exit 2
cmdline="${3:-/proc/$pid/cmdline}"
[ -r "$cmdline" ] || exit 1

tls=0
write=0
auth=0
random=0
readonly=0
unknown=0
path=/

normalize_path() {
    value="$1"
    value="$(printf '%s' "$value" | tr -d '\r\n')"
    value="${value#/}"
    value="${value%/}"
    if [ -n "$value" ]; then
        printf '/%s/' "$value"
    else
        printf '/'
    fi
}

# Bash cannot safely hold NUL bytes in a variable. readarray -d keeps each
# argv element separate and nothing is printed until sensitive values have
# been reduced to facts.
mapfile -d '' -t argv < "$cmdline"
[ "${#argv[@]}" -gt 0 ] || exit 1

if [ "$provider" = gotty ]; then
    i=1
    while [ "$i" -lt "${#argv[@]}" ]; do
        arg="${argv[$i]}"
        case "$arg" in
            --) break ;;
            --tls|-tls|-t) tls=1 ;;
            --permit-write|-permit-write|-w) write=1 ;;
            --random-url|-random-url|-r) random=1 ;;
            --credential|-credential|-c)
                auth=1
                i=$((i + 1))
                ;;
            --credential=*|-credential=*|-c=*|-c?*) auth=1 ;;
            --path|-path|-m)
                i=$((i + 1))
                [ "$i" -lt "${#argv[@]}" ] && path="$(normalize_path "${argv[$i]}")"
                ;;
            --path=*|-path=*|-m=*)
                path="$(normalize_path "${arg#*=}")"
                ;;
            --address|-address|-a|--port|-port|-p|--random-url-length|-random-url-length|--tls-crt|-tls-crt|--tls-key|-tls-key|--tls-ca-crt|-tls-ca-crt|--index|-index|--title-format|-title-format|--reconnect-time|-reconnect-time|--max-connection|-max-connection|--timeout|-timeout|--width|-width|--height|-height|--ws-origin|-ws-origin|--ws-query-args|-ws-query-args|--close-signal|-close-signal|--close-timeout|-close-timeout|--config|-config)
                i=$((i + 1))
                ;;
            --address=*|-address=*|-a=*|--port=*|-port=*|-p=*|--random-url-length=*|-random-url-length=*|--tls-crt=*|-tls-crt=*|--tls-key=*|-tls-key=*|--tls-ca-crt=*|-tls-ca-crt=*|--index=*|-index=*|--title-format=*|-title-format=*|--reconnect-time=*|-reconnect-time=*|--max-connection=*|-max-connection=*|--timeout=*|-timeout=*|--width=*|-width=*|--height=*|-height=*|--ws-origin=*|-ws-origin=*|--ws-query-args=*|-ws-query-args=*|--close-signal=*|-close-signal=*|--close-timeout=*|-close-timeout=*|--config=*|-config=*) ;;
            -*) unknown=1 ;;
            *) break ;;
        esac
        i=$((i + 1))
    done
elif [ "$provider" = ttyd ]; then
    i=1
    while [ "$i" -lt "${#argv[@]}" ]; do
        arg="${argv[$i]}"
        case "$arg" in
            --) break ;;
            --ssl) tls=1 ;;
            --writable) write=1 ;;
            --readonly) readonly=1 ;;
            --credential|--cred|--crede|--creden|--credent|--credenti|--credentia)
                auth=1
                i=$((i + 1))
                ;;
            --credential=*|--cred=*|--crede=*|--creden=*|--credent=*|--credenti=*|--credentia=*) auth=1 ;;
            --auth-header)
                auth=1
                i=$((i + 1))
                ;;
            --auth-header=*) auth=1 ;;
            --base-path)
                i=$((i + 1))
                [ "$i" -lt "${#argv[@]}" ] && path="$(normalize_path "${argv[$i]}")"
                ;;
            --base-path=*) path="$(normalize_path "${arg#*=}")" ;;
            --port|--interface|--uid|--gid|--signal|--cwd|--terminal-type|--client-option|--ping-interval|--ssl-cert|--ssl-key|--ssl-ca|--max-clients|--debug|--url-arg|--ipv6|--font)
                i=$((i + 1))
                ;;
            --port=*|--interface=*|--uid=*|--gid=*|--signal=*|--cwd=*|--terminal-type=*|--client-option=*|--ping-interval=*|--ssl-cert=*|--ssl-key=*|--ssl-ca=*|--max-clients=*|--debug=*|--url-arg=*|--ipv6=*|--font=*) ;;
            --browser|--once|--exit-no-conn|--ipv6-only) ;;
            --*) unknown=1 ;;
            -*)
                short="${arg#-}"
                while [ -n "$short" ]; do
                    opt="${short%${short#?}}"
                    short="${short#?}"
                    case "$opt" in
                        S) tls=1 ;;
                        W) write=1 ;;
                        R) readonly=1 ;;
                        B|o|q|6) ;;
                        c)
                            auth=1
                            if [ -z "$short" ]; then i=$((i + 1)); fi
                            short=''
                            ;;
                        b)
                            if [ -n "$short" ]; then
                                path="$(normalize_path "$short")"
                            else
                                i=$((i + 1))
                                [ "$i" -lt "${#argv[@]}" ] && path="$(normalize_path "${argv[$i]}")"
                            fi
                            short=''
                            ;;
                        H)
                            auth=1
                            if [ -z "$short" ]; then i=$((i + 1)); fi
                            short=''
                            ;;
                        p|i|u|g|s|w|T|t|P|C|K|A|m|d|U|I|f)
                            if [ -z "$short" ]; then i=$((i + 1)); fi
                            short=''
                            ;;
                        *) unknown=1 ;;
                    esac
                done
                ;;
            *) break ;;
        esac
        i=$((i + 1))
    done
else
    exit 2
fi

printf 'inspected=1\n'
printf 'tls=%s\n' "$tls"
printf 'permitWrite=%s\n' "$write"
printf 'authentication=%s\n' "$auth"
printf 'randomUrl=%s\n' "$random"
printf 'readonly=%s\n' "$readonly"
printf 'unknown=%s\n' "$unknown"
printf 'path=%s\n' "$path"
`;

export function parseTerminalInspectionFacts(output) {
    const values = {};
    for (const line of String(output || '').split(/\r?\n/)) {
        const separator = line.indexOf('=');
        if (separator <= 0)
            continue;
        values[line.slice(0, separator)] = line.slice(separator + 1);
    }
    return {
        inspected: values.inspected === '1',
        tls: values.tls === '1',
        permitWrite: values.permitWrite === '1',
        authentication: values.authentication === '1',
        randomUrl: values.randomUrl === '1',
        readonly: values.readonly === '1',
        unknownOptions: values.unknown === '1',
        path: values.path || '/',
    };
}

function pidsForProvider(provider, socketOutput) {
    return provider === 'ttyd' ? ttydListenerPids(socketOutput) : gottyListenerPids(socketOutput);
}

export async function inspectTerminalListenersSafely(cockpit, provider, listeners, socketOutput) {
    const pidsByPort = pidsForProvider(provider, socketOutput);
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
                reason: `${provider === 'ttyd' ? 'ttyd' : 'GoTTY'} process arguments are not visible to this user.`,
            };
            return;
        }

        try {
            const facts = await cockpit.spawn(
                ['bash', '-c', TERMINAL_INSPECTION_SCRIPT, 'bash', provider, String(pid)],
                { superuser: 'try', err: 'message' }
            );
            result[port] = parseTerminalInspectionFacts(facts);
        } catch (_) {
            result[port] = {
                inspected: false,
                reason: `${provider === 'ttyd' ? 'ttyd' : 'GoTTY'} process options could not be inspected safely.`,
            };
        }
    }));

    return result;
}
