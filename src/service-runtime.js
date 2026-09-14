import { expandUrl } from './bookmarks.js';
import {
    APPLICATION_LAUNCHER_TYPE,
    startApplicationLauncher,
    stopApplicationLauncher,
} from './application-launcher.js';
import {
    TERMINAL_LAUNCHER_TYPE,
    startTerminalLauncher,
    stopTerminalLauncher,
} from './terminal-launcher.js';

export const SERVICE_KIND_BOOKMARK = 'bookmark';
export const SERVICE_KIND_TERMINAL = 'terminal';
export const SERVICE_KIND_APPLICATION = 'application';

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

function errorMessage(cockpit, error) {
    try {
        return cockpit?.message ? cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
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
        if (!tab.closed)
            tab.location.replace(expandUrl(service.url, hostname));
        return tab;
    } catch (error) {
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
        if (!tab.closed)
            tab.location.replace(result.url);
        return tab;
    } catch (error) {
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
        return stopTerminalLauncher(cockpit, service);
    if (kind === SERVICE_KIND_APPLICATION)
        return stopApplicationLauncher(cockpit, service);
    return undefined;
}
