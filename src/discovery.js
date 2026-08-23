import { expandUrl } from './bookmarks.js';

const TLS_PORTS = new Set([443, 8443, 9443, 10443]);
const WEB_PORTS = new Set([
    80, 81, 443, 631,
    3000, 3001, 5000, 5001, 5601,
    8000, 8001, 8008, 8080, 8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089, 8090,
    8123, 8443, 8888, 9000, 9001, 9091, 9100, 9443, 10000,
]);
const NON_WEB_PORTS = new Set([
    20, 21, 22, 23, 25, 53, 110, 111, 135, 139, 143, 389, 445, 465, 587, 636,
    873, 993, 995, 1433, 1521, 2049, 2375, 2376, 3306, 3389, 5432, 5672, 5900,
    6379, 6443, 11211, 27017,
]);

const WEB_PROCESS_HINT = /(apache|caddy|code-server|grafana|gunicorn|hass|home-assistant|httpd|jellyfin|kibana|minio|navidrome|nginx|node|php|plex|portainer|prometheus|python|qbittorrent|syncthing|tomcat|traefik|transmission|uvicorn|vaultwarden)/i;
const NON_WEB_PROCESS_HINT = /(mariadbd|mongod|mysqld|postgres|redis-server|rpcbind|smbd|sshd)/i;

const PROCESS_LABELS = new Map([
    ['apache2', 'Apache'],
    ['caddy', 'Caddy'],
    ['code-server', 'Code Server'],
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

function loopbackAddress(address) {
    const value = String(address || '').replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
    return value === '::1' || value === 'localhost' || value.startsWith('127.');
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
    if (listener.process && /cockpit/i.test(listener.process))
        return { supported: false, reason: 'Cockpit itself' };
    if (NON_WEB_PORTS.has(listener.port) || NON_WEB_PROCESS_HINT.test(listener.process))
        return { supported: false, reason: 'Known non-web/system listener' };
    return { supported: true, reason: '' };
}

export function buildDiscoveryCandidates(listeners, services, hostname) {
    const existingPorts = existingLocalBookmarkPorts(services, hostname);

    return (listeners || []).map(listener => {
        const scheme = TLS_PORTS.has(listener.port) ? 'https' : 'http';
        const support = listenerSupport(listener);
        const likelyWeb = WEB_PORTS.has(listener.port) || WEB_PROCESS_HINT.test(listener.process);
        const alreadyBookmarked = existingPorts.has(listener.port);
        const portTag = `port-${listener.port}`;
        const processTag = String(listener.process || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        return {
            ...listener,
            scheme,
            url: `${scheme}://{host}:${listener.port}`,
            name: serviceLabel(listener.process, listener.port),
            supported: support.supported,
            reason: support.reason,
            likelyWeb,
            alreadyBookmarked,
            selected: support.supported && likelyWeb && !listener.localOnly && !alreadyBookmarked && listener.port !== 9090,
            bookmark: {
                name: serviceLabel(listener.process, listener.port),
                url: `${scheme}://{host}:${listener.port}`,
                description: listener.process
                    ? `Detected ${listener.process} listening on TCP port ${listener.port}`
                    : `Detected TCP listener on port ${listener.port}`,
                group: 'Discovered',
                icon: '🌐',
                tags: ['discovered', portTag, ...(processTag ? [processTag] : [])],
            },
        };
    });
}
