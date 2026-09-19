const TTYD_PROCESS_HINT = /(^|[^a-z0-9])ttyd([^a-z0-9]|$)/i;

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

function normalizePath(value) {
    const raw = String(value || '/').trim();
    if (!raw || raw === '/')
        return '/';
    return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

function terminalBookmark(listener, info) {
    const path = normalizePath(info?.path);
    const scheme = info?.tls ? 'https' : 'http';
    const url = `${scheme}://{host}:${listener.port}${path}`;
    const securityNotes = [];

    if (info?.permitWrite) {
        securityNotes.push('Interactive input is enabled (--writable). Treat this terminal as privileged access.');
    } else if (info?.readonly) {
        securityNotes.push('ttyd is explicitly read-only (--readonly).');
    } else if (info?.inspected) {
        securityNotes.push('No write flag was detected. ttyd 1.7+ is read-only by default; older releases may accept input unless started with --readonly.');
    }
    if (info?.authentication)
        securityNotes.push('Authentication is configured. Credential values never leave the host inspection process.');
    if (info?.tls)
        securityNotes.push('TLS is enabled by the ttyd command line.');
    if (info?.unknownOptions)
        securityNotes.push('Unrecognized ttyd options were present; the inferred URL or security state may be approximate.');
    if (!info?.inspected)
        securityNotes.push(info?.reason || 'ttyd options could not be inspected; URL settings are approximate.');

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
                readonly: info?.readonly === true,
                authentication: info?.authentication === true,
                unknownOptions: info?.unknownOptions === true,
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
