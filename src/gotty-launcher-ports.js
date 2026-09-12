export const GOTTY_LAUNCHER_PORT_START = 47200;
export const GOTTY_LAUNCHER_PORT_END = 47299;

export function parseListeningTcpPorts(output) {
    const ports = new Set();
    for (const rawLine of String(output || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line)
            continue;
        const columns = line.split(/\s+/);
        const endpoint = columns[3] || '';
        const match = endpoint.match(/:(\d+)$/);
        if (!match)
            continue;
        const port = Number(match[1]);
        if (Number.isInteger(port) && port >= 1 && port <= 65535)
            ports.add(port);
    }
    return ports;
}

export function suggestGoTTYLauncherPort(launchers = [], listeningPorts = []) {
    const used = new Set();

    for (const service of launchers) {
        const port = Number(service?.gottyLauncher?.port);
        if (Number.isInteger(port))
            used.add(port);
    }

    for (const value of listeningPorts) {
        const port = Number(value);
        if (Number.isInteger(port))
            used.add(port);
    }

    for (let port = GOTTY_LAUNCHER_PORT_START; port <= GOTTY_LAUNCHER_PORT_END; port += 1) {
        if (!used.has(port))
            return port;
    }

    return null;
}

export async function findAvailableGoTTYLauncherPort(cockpit, launchers = []) {
    let listeningPorts = [];
    try {
        const output = await cockpit?.spawn?.(['ss', '-H', '-ltn'], { err: 'ignore' });
        listeningPorts = parseListeningTcpPorts(output);
    } catch (_) {
        // The configured launcher list still prevents duplicate launcher ports.
    }
    return suggestGoTTYLauncherPort(launchers, listeningPorts);
}
