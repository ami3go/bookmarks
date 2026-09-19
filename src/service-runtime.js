import { expandUrl } from './bookmarks.js';
import {
    APPLICATION_LAUNCHER_TYPE,
    applicationUnitName,
    startApplicationLauncher,
    stopApplicationLauncher,
} from './application-launcher.js';
import { errorMessage, readLauncherOutput } from './launcher-runtime.js';
import {
    TERMINAL_LAUNCHER_TYPE,
    launcherUnitName,
    startTerminalLauncher,
    stopTerminalLauncher,
} from './terminal-launcher.js';

export const SERVICE_KIND_BOOKMARK = 'bookmark';
export const SERVICE_KIND_TERMINAL = 'terminal';
export const SERVICE_KIND_APPLICATION = 'application';
export const LAUNCHER_STATE_CHANGED_EVENT = 'cockpit-bookmarks:launcher-state-changed';

export function serviceKind(service) {
    if (service?.type === TERMINAL_LAUNCHER_TYPE)
        return SERVICE_KIND_TERMINAL;
    if (service?.type === APPLICATION_LAUNCHER_TYPE)
        return SERVICE_KIND_APPLICATION;
    return SERVICE_KIND_BOOKMARK;
}

export function isLauncherService(service) {
    return serviceKind(service) !== SERVICE_KIND_BOOKMARK;
}

export function serviceUnitName(service) {
    const kind = serviceKind(service);
    if (kind === SERVICE_KIND_TERMINAL)
        return launcherUnitName(service.id);
    if (kind === SERVICE_KIND_APPLICATION)
        return applicationUnitName(service.id);
    return '';
}

function emitLauncherStateChanged(service) {
    try {
        window.dispatchEvent(new CustomEvent(LAUNCHER_STATE_CHANGED_EVENT, {
            detail: { id: service?.id || '', unit: serviceUnitName(service) },
        }));
    } catch (_) {
        // Runtime helpers are also exercised in non-browser unit tests.
    }
}

function writePendingTab(tab, title, message) {
    if (!tab || tab.closed)
        return;
    try {
        tab.document.title = title;
        tab.document.body.replaceChildren();
        tab.document.body.style.fontFamily = 'system-ui, sans-serif';
        tab.document.body.style.padding = '2rem';
        const heading = tab.document.createElement('h2');
        heading.textContent = title;
        const paragraph = tab.document.createElement('p');
        paragraph.textContent = message;
        tab.document.body.append(heading, paragraph);
    } catch (_) {
        // The pending tab may already have navigated away.
    }
}

function openPendingTab(openWindow, title, message) {
    const tab = openWindow('about:blank', '_blank');
    if (!tab)
        return null;
    try {
        tab.opener = null;
    } catch (_) {
        // Best effort; the tab still remains usable.
    }
    writePendingTab(tab, title, message);
    return tab;
}

async function openTerminal(service, cockpit, hostname, openWindow) {
    const tab = openPendingTab(
        openWindow,
        'Starting terminal…',
        'Starting the configured terminal application on the Cockpit host.'
    );
    if (!tab)
        return null;

    try {
        await startTerminalLauncher(cockpit, service, hostname);
        emitLauncherStateChanged(service);
        if (!tab.closed)
            tab.location.replace(expandUrl(service.url, hostname));
        return tab;
    } catch (error) {
        emitLauncherStateChanged(service);
        writePendingTab(tab, 'Could not start terminal', errorMessage(cockpit, error));
        return tab;
    }
}

async function openApplication(service, cockpit, hostname, openWindow) {
    const tab = openPendingTab(
        openWindow,
        'Starting application…',
        'Starting the configured application on the Cockpit host and waiting for its browser URL.'
    );
    if (!tab)
        return null;

    try {
        const result = await startApplicationLauncher(cockpit, service, hostname);
        emitLauncherStateChanged(service);
        if (!tab.closed)
            tab.location.replace(result.url);
        return tab;
    } catch (error) {
        emitLauncherStateChanged(service);
        writePendingTab(tab, 'Could not start application', errorMessage(cockpit, error));
        return tab;
    }
}

export function openService(service, {
    cockpit = window.cockpit,
    hostname = window.location.hostname,
    openWindow = window.open.bind(window),
} = {}) {
    const kind = serviceKind(service);
    if (kind === SERVICE_KIND_TERMINAL)
        return openTerminal(service, cockpit, hostname, openWindow);
    if (kind === SERVICE_KIND_APPLICATION)
        return openApplication(service, cockpit, hostname, openWindow);

    const url = service?.resolvedUrl || expandUrl(service?.url, hostname);
    if (service?.openMode === 'same-tab')
        return openWindow(url, '_top');
    return openWindow(url, '_blank', 'noopener,noreferrer');
}

export async function stopService(service, cockpit = window.cockpit) {
    const kind = serviceKind(service);
    if (kind === SERVICE_KIND_TERMINAL)
        await stopTerminalLauncher(cockpit, service);
    else if (kind === SERVICE_KIND_APPLICATION)
        await stopApplicationLauncher(cockpit, service);
    else
        return undefined;
    emitLauncherStateChanged(service);
    return undefined;
}

export async function restartService(service, {
    cockpit = window.cockpit,
    hostname = window.location.hostname,
} = {}) {
    if (!isLauncherService(service))
        return undefined;
    await stopService(service, cockpit);
    const kind = serviceKind(service);
    const result = kind === SERVICE_KIND_TERMINAL
        ? await startTerminalLauncher(cockpit, service, hostname)
        : await startApplicationLauncher(cockpit, service, hostname);
    emitLauncherStateChanged(service);
    return result;
}

export async function readServiceOutput(service, cockpit = window.cockpit, maxBytes = 65536) {
    const unit = serviceUnitName(service);
    if (!unit)
        return '';
    return readLauncherOutput(cockpit, unit, maxBytes);
}

export function parseLauncherStates(output) {
    const states = new Map();
    let id = '';
    let activeState = '';
    const flush = () => {
        if (!id)
            return;
        states.set(id, activeState === 'active' ? 'running' : activeState === 'failed' ? 'failed' : 'stopped');
        id = '';
        activeState = '';
    };

    for (const line of String(output || '').split(/\r?\n/)) {
        if (!line.trim()) {
            flush();
            continue;
        }
        if (line.startsWith('Id='))
            id = line.slice(3).trim();
        else if (line.startsWith('ActiveState='))
            activeState = line.slice('ActiveState='.length).trim();
    }
    flush();
    return states;
}

export async function launcherStates(services, cockpit = window.cockpit) {
    const launchers = (services || []).filter(isLauncherService);
    const result = new Map(launchers.map(service => [service.id, 'stopped']));
    const units = launchers.map(serviceUnitName).filter(Boolean);
    if (!units.length || !cockpit?.spawn)
        return result;

    try {
        const output = await cockpit.spawn([
            'systemctl', '--user', 'show', '--property=Id', '--property=ActiveState', '--', ...units,
        ], { err: 'ignore' });
        const byUnit = parseLauncherStates(output);
        for (const service of launchers) {
            const state = byUnit.get(serviceUnitName(service));
            if (state)
                result.set(service.id, state);
        }
    } catch (_) {
        // Unknown/unloaded units are equivalent to stopped launchers here.
    }
    return result;
}
