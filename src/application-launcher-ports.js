import {
    findAvailableTcpPort,
    suggestAvailableTcpPort,
} from './tcp-ports.js';

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

export function findAvailableApplicationLauncherPort(cockpit, services = []) {
    return findAvailableTcpPort(
        cockpit,
        services,
        APPLICATION_LAUNCHER_PORT_START,
        APPLICATION_LAUNCHER_PORT_END
    );
}
