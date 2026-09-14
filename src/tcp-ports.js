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

export function configuredLauncherPorts(services = []) {
    const ports = new Set();
    for (const service of services) {
        for (const value of [service?.gottyLauncher?.port, service?.applicationLauncher?.port]) {
            const port = Number(value);
            if (Number.isInteger(port))
                ports.add(port);
        }
    }
    return ports;
}

export function suggestAvailableTcpPort(services = [], listeningPorts = [], start, end) {
    const used = configuredLauncherPorts(services);
    for (const value of listeningPorts) {
        const port = Number(value);
        if (Number.isInteger(port))
            used.add(port);
    }

    for (let port = start; port <= end; port += 1) {
        if (!used.has(port))
            return port;
    }
    return null;
}

export async function findAvailableTcpPort(cockpit, services, start, end) {
    let listeningPorts = [];
    try {
        const output = await cockpit?.spawn?.(['ss', '-H', '-ltn'], { err: 'ignore' });
        listeningPorts = parseListeningTcpPorts(output);
    } catch (_) {
        // Saved launcher configuration still prevents duplicate configured ports.
    }
    return suggestAvailableTcpPort(services, listeningPorts, start, end);
}
