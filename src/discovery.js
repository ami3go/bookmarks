import { expandUrl } from './bookmarks.js';

const TLS_PORTS = new Set([443, 8443, 9443, 10443]);
const WEB_PORTS = new Set([
    80, 81, 443, 631,
    3000, 3001, 5000, 5001, 5601,
    8000, 8001, 8008, 8080, 8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089, 8090,
    8123, 8443, 8888, 9000, 9001, 9091, 9443, 10000,
]);
const NON_WEB_PORTS = new Set([
    20, 21, 22, 23, 25, 53, 110, 111, 135, 139, 143, 389, 445, 465, 587, 636,
    873, 993, 995, 1433, 1521, 2049, 2375, 2376, 3306, 3389, 5432, 5672, 5900,
    6379, 6443, 11211, 27017,
]);

const WEB_PROCESS_HINT = /(apache|caddy|code-server|gotty|grafana|gunicorn|hass|home-assistant|httpd|jellyfin|kibana|minio|navidrome|nginx|node|php|plex|portainer|prometheus|python|qbittorrent|syncthing|tomcat|traefik|transmission|uvicorn|vaultwarden)/i;
const NON_WEB_PROCESS_HINT = /(mariadbd|mongod|mysqld|postgres|redis-server|rpcbind|smbd|sshd)/i;
const GOTTY_PROCESS_HINT = /(^|[^a-z0-9])gotty([^a-z0-9]|$)/i;

const PROCESS_LABELS = new Map([
    ['apache2', 'Apache'],
    ['caddy', 'Caddy'],
    ['code-server', 'Code Server'],
    ['gotty', 'GoTTY Terminal'],
    ['grafana', 'Grafana'],
    ['grafana-server', 'Grafana'],
    ['hass', 'Home Assistant'],
    ['home-assistant', 'Home Assistant'],
    ['httpd', 'Apache'],
    ['jellyfin', 'Jellyfin'],
    ['kibana', 'Kibana'],
    ['minio', 'MinIO'],
    ['navidrome', 'Navidrome'],
    ['nginx', 'Nginx'],
    ['node_exporter', 'Node Exporter'],
    ['plexmediaserver', 'Plex'],
    ['portainer', 'Portainer'],
    ['prometheus', 'Prometheus'],
    ['qbittorrent-nox', 'qBittorrent'],
    ['syncthing', 'Syncthing'],
    ['traefik', 'Traefik'],
    ['transmission-da', 'Transmission'],
    ['vaultwarden', 'Vaultwarden'],
]);

const GOTTY_VALUE_OPTIONS = new Set([
    '--address', '-a', '--port', '-p', '--path', '-m', '--credential', '-c', '--random-url-length',
    '--tls-crt', '--tls-key', '--tls-ca-crt', '--index', '--title-format', '--reconnect-time',
    '--max-connection', '--timeout', '--width', '--height', '--ws-origin', '--ws-query-args',
    '--close-signal', '--close-timeout', '--config',
]);

function endpointParts(endpoint) {
    const value = String(endpoint || '').trim();
    const match = value.match(/^(.*):(\d+)$/);
    if (!match)
        return null;

    const port = Number(match[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        return null;

    let address = match[1];
    if (address.startsWith('[') && address.endsWith(']'))
        address = address.slice(1, -1);

    return { address, port };
}

function processNames(line) {
    const result = [];
    for (const match of String(line || '').matchAll(/"([^"]+)",pid=/g)) {
        if (!result.includes(match[1]))
            result.push(match[1]);
    }
    return result;
}

function listenerProcessNames(listener) {
    const values = Array.isArray(listener?.processes) && listener.processes.length
        ? listener.processes
        : [listener?.process];
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function loopbackAddress(address) {
    const value = String(address || '').replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
    return value === '::1' || value === 'localhost' || value.startsWith('127.');
}

function isGoTTYProcess(value) {
    return GOTTY_PROCESS_HINT.test(String(value || '').toLowerCase());
}

function listenerIsGoTTY(listener) {
    return listenerProcessNames(listener).some(isGoTTYProcess);
}

export function parseListeningSockets(output) {
    const byPort = new Map();

    for (const rawLine of String(output || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line)
            continue;

        const columns = line.split(/\s+/);
        if (columns.length < 4 || columns[0] !== 'LISTEN')
            continue;

        const endpoint = endpointParts(columns[3]);
        if (!endpoint)
            continue;

        if (!byPort.has(endpoint.port)) {
            byPort.set(endpoint.port, {
                port: endpoint.port,
                addresses: new Set(),
                processes: new Set(),
            });
        }

        const entry = byPort.get(endpoint.port);
        entry.addresses.add(endpoint.address);
        for (const name of processNames(line))
            entry.processes.add(name);
    }

    return [...byPort.values()]
        .map(entry => {
            const addresses = [...entry.addresses];
            const processes = [...entry.processes];
            return {
                port: entry.port,
                addresses,
                processes,
                process: processes[0] || '',
                localOnly: addresses.length > 0 && addresses.every(loopbackAddress),
            };
        })
        .sort((left, right) => left.port - right.port);
}

export function gottyListenerPids(output) {
    const result = new Map();

    for (const rawLine of String(output || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || !line.includes('pid='))
            continue;

        const columns = line.split(/\s+/);
        if (columns.length < 4 || columns[0] !== 'LISTEN')
            continue;
        const endpoint = endpointParts(columns[3]);
        if (!endpoint || !processNames(line).some(isGoTTYProcess))
            continue;

        const pids = result.get(endpoint.port) || new Set();
        for (const match of line.matchAll(/"([^"]+)",pid=(\d+)/g)) {
            if (isGoTTYProcess(match[1]))
                pids.add(Number(match[2]));
        }
        if (pids.size)
            result.set(endpoint.port, pids);
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

function normalizeGoTTYPath(value) {
    const raw = String(value || '/').trim();
    if (!raw || raw === '/')
        return '/';
    return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

export function parseGoTTYCommandLine(commandLine) {
    const args = commandLineArguments(commandLine);
    const result = {
        inspected: true,
        tls: false,
        permitWrite: false,
        authentication: false,
        randomUrl: false,
        path: '/',
    };

    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--')
            break;
        if (!argument.startsWith('-'))
            break;

        if (argument === '--tls' || argument === '-t') {
            result.tls = true;
            continue;
        }
        if (argument === '--permit-write' || argument === '-w') {
            result.permitWrite = true;
            continue;
        }
        if (argument === '--random-url' || argument === '-r') {
            result.randomUrl = true;
            continue;
        }
        if (argument.startsWith('--path=')) {
            result.path = normalizeGoTTYPath(argument.slice('--path='.length));
            continue;
        }
        if (argument.startsWith('--credential=')) {
            result.authentication = true;
            continue;
        }
        if (argument === '--path' || argument === '-m') {
            result.path = normalizeGoTTYPath(args[index + 1]);
            index += 1;
            continue;
        }
        if (argument === '--credential' || argument === '-c') {
            result.authentication = true;
            index += 1;
            continue;
        }

        const equals = argument.indexOf('=');
        const optionName = equals === -1 ? argument : argument.slice(0, equals);
        if (GOTTY_VALUE_OPTIONS.has(optionName) && equals === -1)
            index += 1;
    }

    return result;
}

export async function inspectGoTTYListeners(cockpit, listeners, socketOutput) {
    const pidsByPort = gottyListenerPids(socketOutput);
    const result = {};

    await Promise.all((listeners || []).filter(listenerIsGoTTY).map(async listener => {
        const pid = pidsByPort[listener.port]?.[0];
        if (!pid) {
            result[listener.port] = {
                inspected: false,
                reason: 'GoTTY process arguments are not visible to this user.',
            };
            return;
        }

        try {
            const commandLine = await cockpit.spawn(['cat', `/proc/${pid}/cmdline`], {
                superuser: 'try',
                err: 'message',
            });
            result[listener.port] = parseGoTTYCommandLine(commandLine);
        } catch (_) {
            result[listener.port] = {
                inspected: false,
                reason: 'GoTTY process arguments could not be inspected.',
            };
        }
    }));

    return result;
}

function normalizeHostname(value) {
    return String(value || '').trim().replace(/^\[|\]$/g, '').toLowerCase();
}

export function existingLocalBookmarkPorts(services, hostname) {
    const ports = new Set();
    const currentHost = normalizeHostname(hostname);

    for (const service of services || []) {
        const rawUrl = String(service?.url || '').trim();
        if (!rawUrl)
            continue;

        try {
            const resolved = new URL(expandUrl(rawUrl, hostname));
            const sameHost = rawUrl.includes('{host}') || normalizeHostname(resolved.hostname) === currentHost;
            if (!sameHost)
                continue;

            const port = Number(resolved.port || (resolved.protocol === 'https:' ? 443 : 80));
            if (Number.isInteger(port))
                ports.add(port);
        } catch (_) {
            // Invalid bookmarks are ignored by discovery duplicate detection.
        }
    }

    return ports;
}

function serviceLabel(process, port) {
    const normalized = String(process || '').trim().toLowerCase();
    if (PROCESS_LABELS.has(normalized))
        return PROCESS_LABELS.get(normalized);
    if (isGoTTYProcess(normalized))
        return 'GoTTY Terminal';

    if (normalized) {
        const words = normalized
            .replace(/[^a-z0-9]+/gi, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (words.length)
            return words.map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
    }

    return `Service ${port}`;
}

function listenerSupport(listener) {
    const processes = listenerProcessNames(listener);
    if (processes.some(process => /cockpit/i.test(process)))
        return { supported: false, reason: 'Cockpit itself' };
    if (NON_WEB_PORTS.has(listener.port) || processes.some(process => NON_WEB_PROCESS_HINT.test(process)))
        return { supported: false, reason: 'Known non-web/system listener' };
    return { supported: true, reason: '' };
}

function gottyCandidate(listener, info, alreadyBookmarked) {
    const scheme = info?.tls ? 'https' : (TLS_PORTS.has(listener.port) ? 'https' : 'http');
    const path = normalizeGoTTYPath(info?.path || '/');
    const url = `${scheme}://{host}:${listener.port}${path}`;
    const securityNotes = [];

    if (info?.permitWrite)
        securityNotes.push('Interactive input is enabled (--permit-write). Treat this terminal as privileged access.');
    if (info?.authentication)
        securityNotes.push('Basic authentication is enabled. Credentials are intentionally not read or stored.');
    if (info?.tls)
        securityNotes.push('TLS is enabled by the GoTTY command line.');
    if (info?.randomUrl)
        securityNotes.push('Random URL mode is enabled. Enter the generated final URL manually; Bookmarks will not reconstruct the secret path.');
    if (!info?.inspected)
        securityNotes.push(info?.reason || 'GoTTY command-line options could not be inspected; URL settings are approximate.');

    const supported = !info?.randomUrl;
    const reason = info?.randomUrl ? 'GoTTY random URL requires a manual bookmark' : '';
    const selected = supported && !listener.localOnly && !alreadyBookmarked && listener.port !== 9090;

    return {
        scheme,
        url,
        name: 'GoTTY Terminal',
        integration: 'gotty',
        supported,
        reason,
        likelyWeb: true,
        selected,
        securityNotes,
        gotty: {
            inspected: info?.inspected === true,
            tls: info?.tls === true,
            permitWrite: info?.permitWrite === true,
            authentication: info?.authentication === true,
            randomUrl: info?.randomUrl === true,
            path,
        },
        bookmark: {
            name: 'GoTTY Terminal',
            url,
            description: `Detected GoTTY web terminal listening on TCP port ${listener.port}`,
            group: 'Terminal',
            icon: '⌨️',
            accent: 'teal',
            tags: ['GoTTY', 'terminal', 'web-terminal', 'discovered', `port-${listener.port}`],
            statusCheck: true,
            integration: 'gotty',
        },
    };
}

export function buildDiscoveryCandidates(listeners, services, hostname, gottyInfoByPort = {}) {
    const existingPorts = existingLocalBookmarkPorts(services, hostname);

    return (listeners || []).map(listener => {
        const processes = listenerProcessNames(listener);
        const representativeProcess = String(listener.process || processes[0] || '');
        const support = listenerSupport(listener);
        const alreadyBookmarked = existingPorts.has(listener.port);
        const isGoTTY = listenerIsGoTTY(listener);

        if (isGoTTY && support.supported) {
            return {
                ...listener,
                alreadyBookmarked,
                ...gottyCandidate(listener, gottyInfoByPort?.[listener.port], alreadyBookmarked),
            };
        }

        const scheme = TLS_PORTS.has(listener.port) ? 'https' : 'http';
        const likelyWeb = WEB_PORTS.has(listener.port) || processes.some(process => WEB_PROCESS_HINT.test(process));
        const portTag = `port-${listener.port}`;
        const processTag = representativeProcess
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        return {
            ...listener,
            scheme,
            url: `${scheme}://{host}:${listener.port}`,
            name: serviceLabel(representativeProcess, listener.port),
            supported: support.supported,
            reason: support.reason,
            likelyWeb,
            alreadyBookmarked,
            selected: support.supported && likelyWeb && !listener.localOnly && !alreadyBookmarked && listener.port !== 9090,
            bookmark: {
                name: serviceLabel(representativeProcess, listener.port),
                url: `${scheme}://{host}:${listener.port}`,
                description: representativeProcess
                    ? `Detected ${representativeProcess} listening on TCP port ${listener.port}`
                    : `Detected TCP listener on port ${listener.port}`,
                group: 'Discovered',
                icon: '🌐',
                tags: ['discovered', portTag, ...(processTag ? [processTag] : [])],
            },
        };
    });
}
