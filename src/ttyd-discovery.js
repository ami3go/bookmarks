const TTYD_PROCESS_HINT = /(^|[^a-z0-9])ttyd([^a-z0-9]|$)/i;

const TTYD_VALUE_OPTIONS = new Set([
    '--port', '-p', '--interface', '-i', '--credential', '-c', '--auth-header', '-H',
    '--uid', '-u', '--gid', '-g', '--signal', '-s', '--cwd', '-w', '--terminal-type', '-T',
    '--client-option', '-t', '--browser', '-B', '--base-path', '-b', '--ping-interval', '-P',
    '--ssl-cert', '-C', '--ssl-key', '-K', '--ssl-ca', '-A', '--max-clients', '-m',
]);

function processNames(line) {
    const result = [];
    for (const match of String(line || '').matchAll(/"([^"]+)",pid=/g)) {
        if (!result.includes(match[1]))
            result.push(match[1]);
    }
    return result;
}

function endpointPort(line) {
    const columns = String(line || '').trim().split(/\s+/);
    if (columns.length < 4 || columns[0] !== 'LISTEN')
        return null;
    const match = columns[3].match(/:(\d+)$/);
    const port = Number(match?.[1]);
    return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

export function isTtydProcess(value) {
    return TTYD_PROCESS_HINT.test(String(value || '').toLowerCase());
}

export function listenerIsTtyd(listener) {
    const processes = Array.isArray(listener?.processes) && listener.processes.length
        ? listener.processes
        : [listener?.process];
    return processes.some(isTtydProcess);
}

export function ttydListenerPids(output) {
    const result = new Map();
    for (const rawLine of String(output || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || !line.includes('pid='))
            continue;
        const port = endpointPort(line);
        if (!port || !processNames(line).some(isTtydProcess))
            continue;
        const pids = result.get(port) || new Set();
        for (const match of line.matchAll(/"([^"]+)",pid=(\d+)/g)) {
            if (isTtydProcess(match[1]))
                pids.add(Number(match[2]));
        }
        if (pids.size)
            result.set(port, pids);
    }
    return Object.fromEntries([...result].map(([port, pids]) => [port, [...pids]]));
}

function commandLineArguments(commandLine) {
    const value = String(commandLine || '');
    if (!value)
        return [];
    if (value.includes('\0'))
        return value.split('\0').map(argument => argument.trim()).filter(Boolean);
    return (value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [])
        .map(argument => argument.replace(/^(?:"(.*)"|'(.*)')$/, (_match, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted ?? ''));
}

function normalizePath(value) {
    const raw = String(value || '/').trim();
    if (!raw || raw === '/')
        return '/';
    return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

export function parseTtydCommandLine(commandLine) {
    const args = commandLineArguments(commandLine);
    const result = {
        inspected: true,
        tls: false,
        permitWrite: false,
        authentication: false,
        path: '/',
    };

    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--')
            break;
        if (!argument.startsWith('-'))
            break;

        if (argument === '--ssl' || argument === '-S') {
            result.tls = true;
            continue;
        }
        if (argument === '--writable' || argument === '-W') {
            result.permitWrite = true;
            continue;
        }
        if (argument.startsWith('--base-path=')) {
            result.path = normalizePath(argument.slice('--base-path='.length));
            continue;
        }
        if (argument.startsWith('--credential=') || argument.startsWith('-c=')) {
            result.authentication = true;
            continue;
        }
        if (argument.startsWith('--auth-header=')) {
            result.authentication = true;
            continue;
        }
        if (argument === '--base-path' || argument === '-b') {
            result.path = normalizePath(args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === '--credential' || argument === '-c' || argument === '--auth-header' || argument === '-H') {
            result.authentication = true;
            index += 1;
            continue;
        }

        const equals = argument.indexOf('=');
        const optionName = equals === -1 ? argument : argument.slice(0, equals);
        if (TTYD_VALUE_OPTIONS.has(optionName) && equals === -1)
            index += 1;
    }
    return result;
}

function normalizeCandidatePath(value) {
    return normalizePath(value || '/');
}

function terminalBookmark(listener, info) {
    const path = normalizeCandidatePath(info?.path);
    const scheme = info?.tls ? 'https' : 'http';
    const url = `${scheme}://{host}:${listener.port}${path}`;
    const securityNotes = [];
    if (info?.permitWrite)
        securityNotes.push('Interactive input is enabled (--writable). Treat this terminal as privileged access.');
    else if (info?.inspected)
        securityNotes.push('ttyd is read-only because --writable is not enabled.');
    if (info?.authentication)
        securityNotes.push('Authentication is configured. Credential values are intentionally not read or stored.');
    if (info?.tls)
        securityNotes.push('TLS is enabled by the ttyd command line.');
    if (!info?.inspected)
        securityNotes.push(info?.reason || 'ttyd command-line options could not be inspected; URL settings are approximate.');

    return { path, scheme, url, securityNotes };
}

export function applyTtydDiscoveryCandidates(candidates, ttydInfoByPort = {}) {
    return (candidates || []).map(candidate => {
        if (!listenerIsTtyd(candidate))
            return candidate;

        const info = ttydInfoByPort?.[candidate.port];
        const terminal = terminalBookmark(candidate, info);
        const selected = !candidate.localOnly && !candidate.alreadyBookmarked && candidate.port !== 9090;
        return {
            ...candidate,
            ...terminal,
            name: 'ttyd Terminal',
            integration: 'ttyd',
            supported: true,
            reason: '',
            likelyWeb: true,
            selected,
            ttyd: {
                inspected: info?.inspected === true,
                tls: info?.tls === true,
                permitWrite: info?.permitWrite === true,
                authentication: info?.authentication === true,
                path: terminal.path,
            },
            bookmark: {
                name: 'ttyd Terminal',
                url: terminal.url,
                description: `Detected ttyd web terminal listening on TCP port ${candidate.port}`,
                group: 'Terminal',
                icon: '⌨️',
                accent: 'teal',
                tags: ['ttyd', 'terminal', 'web-terminal', 'discovered', `port-${candidate.port}`],
                statusCheck: true,
                integration: 'ttyd',
            },
        };
    });
}
