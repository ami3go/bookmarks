import { parseListeningTcpPorts } from './gotty-launcher-ports.js';

export const APPLICATION_LAUNCHER_PORT_START = 47300;
export const APPLICATION_LAUNCHER_PORT_END = 47399;

export function suggestApplicationLauncherPort(services = [], listeningPorts = []) {
    const used = new Set();
    for (const service of services) {
        const terminalPort = Number(service?.gottyLauncher?.port);
        const applicationPort = Number(service?.applicationLauncher?.port);
        if (Number.isInteger(terminalPort))
            used.add(terminalPort);
        if (Number.isInteger(applicationPort))
            used.add(applicationPort);
    }
    for (const value of listeningPorts) {
        const port = Number(value);
        if (Number.isInteger(port))
            used.add(port);
    }
    for (let port = APPLICATION_LAUNCHER_PORT_START; port <= APPLICATION_LAUNCHER_PORT_END; port += 1) {
        if (!used.has(port))
            return port;
    }
    return null;
}

export async function findAvailableApplicationLauncherPort(cockpit, services = []) {
    let listeningPorts = [];
    try {
        const output = await cockpit?.spawn?.(['ss', '-H', '-ltn'], { err: 'ignore' });
        listeningPorts = parseListeningTcpPorts(output);
    } catch (_) {
        // Configured services still prevent duplicate saved launcher ports.
    }
    return suggestApplicationLauncherPort(services, listeningPorts);
}
