import { newBookmarkId } from './bookmarks.js';
import {
    buildTransientUnitArguments,
    cleanLauncherId,
    cleanLauncherText,
    formatArgumentLines,
    parseArgumentLines,
    probeAddress,
    sleep,
    stopUserUnit,
    tcpPortListening,
    tcpPortReady,
    userUnitActive,
} from './launcher-runtime.js';

// Keep the legacy type/path/unit names so existing GoTTY launcher bookmarks and
// copied URLs remain valid. The provider field selects the actual terminal
// server for both old and new launchers.
export const GOTTY_LAUNCHER_TYPE = 'gotty-launcher';
export const TERMINAL_LAUNCHER_TYPE = GOTTY_LAUNCHER_TYPE;
export const TERMINAL_LAUNCHER_EDIT_EVENT = 'cockpit-bookmarks:edit-terminal-launcher';
export const GOTTY_LAUNCHER_PATH_PREFIX = '/cb-gotty-';
export const TERMINAL_PROVIDER_GOTTY = 'gotty';
export const TERMINAL_PROVIDER_TTYD = 'ttyd';
export const TERMINAL_PROVIDERS = [TERMINAL_PROVIDER_GOTTY, TERMINAL_PROVIDER_TTYD];

export const DEFAULT_TERMINAL_LAUNCHER = {
    provider: TERMINAL_PROVIDER_GOTTY,
    binary: 'gotty',
    command: '',
    args: [],
    port: 8085,
    address: '127.0.0.1',
    // 0 means no RuntimeMaxSec limit. The UI presents this as infinity.
    autoStopMinutes: 0,
};
export const DEFAULT_GOTTY_LAUNCHER = DEFAULT_TERMINAL_LAUNCHER;

export function normalizeTerminalProvider(value) {
    return String(value || '').toLowerCase() === TERMINAL_PROVIDER_TTYD
        ? TERMINAL_PROVIDER_TTYD
        : TERMINAL_PROVIDER_GOTTY;
}

export function terminalProviderLabel(value) {
    return normalizeTerminalProvider(value) === TERMINAL_PROVIDER_TTYD ? 'ttyd' : 'GoTTY';
}

export function defaultBinaryForProvider(value) {
    return normalizeTerminalProvider(value) === TERMINAL_PROVIDER_TTYD ? 'ttyd' : 'gotty';
}

export function launcherPath(id) {
    return `${GOTTY_LAUNCHER_PATH_PREFIX}${cleanLauncherId(id)}/`;
}

export function launcherUrl(id, port) {
    return `http://{host}:${Number(port)}${launcherPath(id)}`;
}

export function launcherIdFromUrl(value) {
    try {
        const parsed = new URL(String(value || ''));
        const match = parsed.pathname.match(/^\/cb-gotty-([A-Za-z0-9-]+)\/?$/);
        return match?.[1] || null;
    } catch (_) {
        return null;
    }
}

export function launcherUnitName(id) {
    return `cockpit-bookmarks-gotty-${cleanLauncherId(id)}.service`;
}

export function parseLauncherArguments(value) {
    return parseArgumentLines(value);
}

export function formatLauncherArguments(value) {
    return formatArgumentLines(value);
}

export function normalizeTerminalLauncher(value = {}) {
    const provider = normalizeTerminalProvider(value.provider);
    const port = Number(value.port);
    const autoStopMinutes = Number(value.autoStopMinutes);
    return {
        provider,
        binary: cleanLauncherText(value.binary) || defaultBinaryForProvider(provider),
        command: cleanLauncherText(value.command),
        args: parseLauncherArguments(value.args),
        port: Number.isInteger(port) ? port : DEFAULT_TERMINAL_LAUNCHER.port,
        address: cleanLauncherText(value.address) || DEFAULT_TERMINAL_LAUNCHER.address,
        autoStopMinutes: Number.isInteger(autoStopMinutes) && autoStopMinutes >= 0
            ? autoStopMinutes
            : DEFAULT_TERMINAL_LAUNCHER.autoStopMinutes,
    };
}

export const normalizeGottyLauncher = normalizeTerminalLauncher;

export function launcherDraft(service = null, suggestedPort = DEFAULT_TERMINAL_LAUNCHER.port) {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher || {
        ...DEFAULT_TERMINAL_LAUNCHER,
        port: suggestedPort,
        address: '{host}',
    });
    return {
        id: service?.id || '',
        name: String(service?.name || ''),
        provider: launcher.provider,
        binary: launcher.binary,
        command: launcher.command,
        args: formatLauncherArguments(launcher.args),
        port: String(launcher.port),
        address: launcher.address,
        autoStopMinutes: String(launcher.autoStopMinutes),
        group: String(service?.group || 'Terminal'),
        icon: String(service?.icon || '⌨️'),
        accent: String(service?.accent || 'teal'),
    };
}

export function validateLauncherDraft(draft) {
    const errors = {};
    const provider = normalizeTerminalProvider(draft.provider);
    const port = Number(draft.port);
    const autoStopMinutes = Number(draft.autoStopMinutes);
    const address = cleanLauncherText(draft.address);

    if (!cleanLauncherText(draft.name))
        errors.name = 'Name is required.';
    if (!cleanLauncherText(draft.command))
        errors.command = 'Application command is required.';
    if (!cleanLauncherText(draft.binary))
        errors.binary = `${terminalProviderLabel(provider)} executable is required.`;
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
        errors.port = 'Use an unprivileged TCP port from 1024 to 65535.';
    if (!address || /[\s/]/.test(address))
        errors.address = 'Use a listen address such as {host}, 127.0.0.1, 0.0.0.0, ::1, or ::.';
    if (!Number.isInteger(autoStopMinutes) || autoStopMinutes < 0 || autoStopMinutes > 720)
        errors.autoStopMinutes = 'Choose no timeout or an auto-stop value from 1 to 720 minutes.';

    return errors;
}

function tagsForLauncher(original, command, provider) {
    const tags = Array.isArray(original?.tags) ? original.tags : [];
    const commandTag = cleanLauncherText(command).split('/').pop()?.toLowerCase() || '';
    const withoutProvider = tags.filter(tag => !['gotty', 'ttyd'].includes(String(tag).toLowerCase()));
    return [...new Set([...withoutProvider, provider, 'launcher', 'terminal', ...(commandTag ? [commandTag] : [])])];
}

export function buildLauncherService(draft, original = null) {
    const id = cleanLauncherId(original?.id || draft.id || newBookmarkId());
    const launcher = normalizeTerminalLauncher({
        provider: draft.provider,
        binary: draft.binary,
        command: draft.command,
        args: draft.args,
        port: Number(draft.port),
        address: draft.address,
        autoStopMinutes: Number(draft.autoStopMinutes),
    });
    const providerLabel = terminalProviderLabel(launcher.provider);

    const service = {
        ...(original || {}),
        id,
        type: TERMINAL_LAUNCHER_TYPE,
        integration: launcher.provider,
        name: cleanLauncherText(draft.name),
        url: launcherUrl(id, launcher.port),
        description: `On-demand ${providerLabel} launcher for ${launcher.command}`,
        group: cleanLauncherText(draft.group) || 'Terminal',
        icon: cleanLauncherText(draft.icon) || '⌨️',
        accent: cleanLauncherText(draft.accent) || 'teal',
        tags: tagsForLauncher(original, launcher.command, launcher.provider),
        gottyLauncher: launcher,
    };

    delete service.openMode;
    delete service.endpoints;
    delete service.statusCheck;
    return service;
}

export function expandLauncherHost(value, hostname) {
    return String(value || '').replaceAll('{host}', String(hostname || ''));
}

export function isNetworkExposedAddress(value) {
    const address = cleanLauncherText(value).toLowerCase();
    return !(address === '127.0.0.1' || address === 'localhost' || address === '::1' || address.startsWith('127.'));
}

export { probeAddress };

function providerArguments(launcher, service, hostname) {
    const address = expandLauncherHost(launcher.address, hostname);
    const command = expandLauncherHost(launcher.command, hostname);
    const args = launcher.args.map(arg => expandLauncherHost(arg, hostname));
    const basePath = launcherPath(service?.id).replace(/\/$/, '');

    if (launcher.provider === TERMINAL_PROVIDER_TTYD) {
        return [
            launcher.binary,
            '--interface', address,
            '--port', String(launcher.port),
            '--writable',
            '--base-path', basePath,
            command,
            ...args,
        ];
    }

    return [
        launcher.binary,
        '--address', address,
        '--port', String(launcher.port),
        '--permit-write',
        '--path', basePath,
        command,
        ...args,
    ];
}

export function buildSystemdRunArguments(service, hostname = '') {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher);
    const command = expandLauncherHost(launcher.command, hostname);
    return buildTransientUnitArguments({
        unit: launcherUnitName(service?.id),
        runtimeSeconds: launcher.autoStopMinutes > 0 ? launcher.autoStopMinutes * 60 : 0,
        description: `Cockpit Bookmarks ${terminalProviderLabel(launcher.provider)}: ${cleanLauncherText(service?.name) || command}`,
        command: providerArguments(launcher, service, hostname),
    });
}

export async function waitForLauncher(cockpit, service, attempts = 28, intervalMs = 250, hostname = '') {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher);
    const address = expandLauncherHost(launcher.address, hostname);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (await tcpPortReady(cockpit, address, launcher.port))
            return true;
        if (attempt + 1 < attempts)
            await sleep(intervalMs);
    }
    return false;
}

export async function stopTerminalLauncher(cockpit, service) {
    return stopUserUnit(cockpit, launcherUnitName(service.id));
}

export const stopGoTTYLauncher = stopTerminalLauncher;

export async function startTerminalLauncher(cockpit, service, hostname = '') {
    if (!cockpit?.spawn)
        throw new Error('Cockpit command execution is unavailable.');
    if (service?.type !== TERMINAL_LAUNCHER_TYPE)
        throw new Error('This bookmark is not a terminal launcher.');

    const launcher = normalizeTerminalLauncher(service.gottyLauncher);
    const errors = validateLauncherDraft({
        name: service.name,
        provider: launcher.provider,
        binary: launcher.binary,
        command: expandLauncherHost(launcher.command, hostname),
        port: launcher.port,
        address: expandLauncherHost(launcher.address, hostname),
        autoStopMinutes: launcher.autoStopMinutes,
    });
    if (Object.keys(errors).length)
        throw new Error(Object.values(errors)[0]);

    const unit = launcherUnitName(service.id);
    if (await userUnitActive(cockpit, unit)) {
        if (await waitForLauncher(cockpit, service, 8, 250, hostname))
            return { reused: true };
        await stopTerminalLauncher(cockpit, service);
    }

    if (await tcpPortListening(cockpit, launcher.port))
        throw new Error(`TCP port ${launcher.port} is already in use by another service.`);

    await cockpit.spawn(buildSystemdRunArguments(service, hostname), { err: 'message' });
    if (!await waitForLauncher(cockpit, service, undefined, undefined, hostname)) {
        await stopTerminalLauncher(cockpit, service).catch(() => {});
        const provider = terminalProviderLabel(launcher.provider);
        throw new Error(`${provider} did not start listening on TCP port ${launcher.port}. Check that systemd user services, ${launcher.binary}, and ${launcher.command} are available.`);
    }

    return { reused: false };
}

export const startGoTTYLauncher = startTerminalLauncher;
