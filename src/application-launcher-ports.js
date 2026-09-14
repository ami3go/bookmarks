import {
    findAvailableTcpPort,
    suggestAvailableTcpPort,
} from './tcp-ports.js';

export const AGENT_OF_EMPIRES_DEFAULT_PORT = 8080;
export const APPLICATION_LAUNCHER_PORT_START = 47300;
export const APPLICATION_LAUNCHER_PORT_END = 47399;

export function suggestApplicationLauncherPort(services = [], listeningPorts = []) {
    return suggestAvailableTcpPort(
        services,
        listeningPorts,
        APPLICATION_LAUNCHER_PORT_START,
        APPLICATION_LAUNCHER_PORT_END
    );
}

export function suggestAgentOfEmpiresPort(services = [], listeningPorts = []) {
    return suggestAvailableTcpPort(
        services,
        listeningPorts,
        AGENT_OF_EMPIRES_DEFAULT_PORT,
        AGENT_OF_EMPIRES_DEFAULT_PORT
    ) ?? suggestApplicationLauncherPort(services, listeningPorts);
}

export function findAvailableApplicationLauncherPort(cockpit, services = []) {
    return findAvailableTcpPort(
        cockpit,
        services,
        APPLICATION_LAUNCHER_PORT_START,
        APPLICATION_LAUNCHER_PORT_END
    );
}

export async function findAvailableAgentOfEmpiresPort(cockpit, services = []) {
    const preferred = await findAvailableTcpPort(
        cockpit,
        services,
        AGENT_OF_EMPIRES_DEFAULT_PORT,
        AGENT_OF_EMPIRES_DEFAULT_PORT
    );
    if (preferred)
        return preferred;
    return findAvailableApplicationLauncherPort(cockpit, services);
}
