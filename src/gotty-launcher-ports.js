import {
    findAvailableTcpPort,
    parseListeningTcpPorts,
    suggestAvailableTcpPort,
} from './tcp-ports.js';

export const GOTTY_LAUNCHER_PORT_START = 47200;
export const GOTTY_LAUNCHER_PORT_END = 47299;

export { parseListeningTcpPorts };

export function suggestGoTTYLauncherPort(launchers = [], listeningPorts = []) {
    return suggestAvailableTcpPort(
        launchers,
        listeningPorts,
        GOTTY_LAUNCHER_PORT_START,
        GOTTY_LAUNCHER_PORT_END
    );
}

export function findAvailableGoTTYLauncherPort(cockpit, launchers = []) {
    return findAvailableTcpPort(
        cockpit,
        launchers,
        GOTTY_LAUNCHER_PORT_START,
        GOTTY_LAUNCHER_PORT_END
    );
}
