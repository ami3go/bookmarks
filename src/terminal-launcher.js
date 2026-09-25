import { newBookmarkId } from './bookmarks.js';
import {
    buildTransientUnitArguments,
    cleanLauncherId,
    cleanLauncherText,
    formatArgumentLines,
    parseArgumentLines,
    prepareLauncherOutput,
    readLauncherOutput,
    resolveExecutablePath,
    sleep,
    stopUserUnit,
    tcpPortListening,
    tcpPortReady,
    userUnitActive,
} from './launcher-runtime.js';
import { checkTerminalProviderCompatibilityCached } from './terminal-provider-compatibility-cache.js';
import { terminalProviderCompatibilityMessage } from './terminal-provider-compatibility.js';

// Keep the legacy type/path/unit names so existing GoTTY launcher bookmarks and
// copied URLs remain valid. The provider field selects the actual terminal
// server for both old and new launchers.
export const GOTTY_LAUNCHER_TYPE = 'gotty-launcher';
export const TERMINAL_LAUNCHER_TYPE = GOTTY_LAUNCHER_TYPE;
export const GOTTY_LAUNCHER_PATH_PREFIX = '/cb-gotty-';
export const TERMINAL_PROVIDER_GOTTY = 'gotty';
export const TERMINAL_PROVIDER_TTYD = 'ttyd';

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

export function stripLauncherHostBrackets(value) {
    return String(value || '').trim().replace(/^\[|\]$/g, '');
}

export function expandLauncherHost(value, hostname) {
    return String(value || '').replaceAll('{host}', stripLauncherHostBrackets(hostname));
}

export function isNetworkExposedAddress(value) {
    const address = cleanLauncherText(value).toLowerCase();
    return !(address === '127.0.0.1' || address === 'localhost' || address === '::1' || address.startsWith('127.'));
}

function addressLooksLikeIp(value) {
    const address = stripLauncherHostBrackets(value).split('%')[0];
    if (address.includes(':'))
        return /^[0-9a-f:.]+$/i.test(address);
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address);
}

export async function resolveTtydBindAddress(cockpit, value) {
    const address = stripLauncherHostBrackets(value);
    if (!address || address === '0.0.0.0' || address === '::' || addressLooksLikeIp(address))
        return address;

    try {
        const output = await cockpit.spawn(['getent', 'ahosts', address], { err: 'ignore' });
        const resolved = String(output || '').trim().split(/\r?\n/)
            .map(line => line.trim().split(/\s+/)[0])
            .find(candidate => candidate && addressLooksLikeIp(candidate));
        if (resolved)
            return stripLauncherHostBrackets(resolved);
    } catch (_) {
        // Fall through to the actionable message below.
    }

    throw new Error(`ttyd cannot bind hostname "${address}". Use an IP address or 127.0.0.1, or make sure getent can resolve the hostname.`);
}

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

export function buildSystemdRunArguments(service, hostname = '', outputFile = '') {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher);
    const command = expandLauncherHost(launcher.command, hostname);
    return buildTransientUnitArguments({
        unit: launcherUnitName(service?.id),
        runtimeSeconds: launcher.autoStopMinutes > 0 ? launcher.autoStopMinutes * 60 : 0,
        description: `Cockpit Bookmarks ${terminalProviderLabel(launcher.provider)}: ${cleanLauncherText(service?.name) || command}`,
        command: providerArguments(launcher, service, hostname),
        outputFile,
    });
}

export async function waitForLauncher(cockpit, service, attempts = 28, intervalMs = 250, hostname = '', sleepFn = sleep) {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher);
    const address = expandLauncherHost(launcher.address, hostname);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (await tcpPortReady(cockpit, address, launcher.port))
            return true;
        if (attempt + 1 < attempts)
            await sleepFn(intervalMs);
    }
    return false;
}

export async function stopTerminalLauncher(cockpit, service) {
    return stopUserUnit(cockpit, launcherUnitName(service.id));
}

async function runtimeTerminalService(cockpit, service, hostname) {
    const launcher = normalizeTerminalLauncher(service.gottyLauncher);
    const expandedAddress = expandLauncherHost(launcher.address, hostname);
    const address = launcher.provider === TERMINAL_PROVIDER_TTYD
        ? await resolveTtydBindAddress(cockpit, expandedAddress)
        : stripLauncherHostBrackets(expandedAddress);
    const binary = await resolveExecutablePath(cockpit, expandLauncherHost(launcher.binary, hostname));
    const command = await resolveExecutablePath(cockpit, expandLauncherHost(launcher.command, hostname));
    return {
        ...service,
        gottyLauncher: {
            ...launcher,
            address,
            binary,
            command,
        },
    };
}

export async function startTerminalLauncher(cockpit, service, hostname = '') {
    if (!cockpit?.spawn)
        throw new Error('Cockpit command execution is unavailable.');
    if (service?.type !== TERMINAL_LAUNCHER_TYPE)
        throw new Error('This bookmark is not a terminal launcher.');

    const launcher = normalizeTerminalLauncher(service.gottyLauncher);
    const expandedAddress = expandLauncherHost(launcher.address, hostname);
    const errors = validateLauncherDraft({
        name: service.name,
        provider: launcher.provider,
        binary: launcher.binary,
        command: expandLauncherHost(launcher.command, hostname),
        port: launcher.port,
        address: stripLauncherHostBrackets(expandedAddress),
        autoStopMinutes: launcher.autoStopMinutes,
    });
    if (Object.keys(errors).length)
        throw new Error(Object.values(errors)[0]);

    const compatibility = await checkTerminalProviderCompatibilityCached(cockpit, launcher.provider, launcher.binary);
    if (!compatibility.supported)
        throw new Error(terminalProviderCompatibilityMessage(compatibility));

    const runtimeService = await runtimeTerminalService(cockpit, service, hostname);
    const runtimeLauncher = normalizeTerminalLauncher(runtimeService.gottyLauncher);
    const unit = launcherUnitName(service.id);
    if (await userUnitActive(cockpit, unit)) {
        if (await waitForLauncher(cockpit, runtimeService, 8, 250, hostname))
            return { reused: true };
        await stopTerminalLauncher(cockpit, runtimeService);
    }

    if (await tcpPortListening(cockpit, runtimeLauncher.port))
        throw new Error(`TCP port ${runtimeLauncher.port} is already in use by another service.`);

    const outputFile = await prepareLauncherOutput(cockpit, unit);
    await cockpit.spawn(buildSystemdRunArguments(runtimeService, hostname, outputFile), { err: 'message' });
    if (!await waitForLauncher(cockpit, runtimeService, undefined, undefined, hostname)) {
        const logs = String(await readLauncherOutput(cockpit, unit) || '').trim().split(/\r?\n/).slice(-4).join(' | ');
        await stopTerminalLauncher(cockpit, runtimeService).catch(() => {});
        const provider = terminalProviderLabel(runtimeLauncher.provider);
        throw new Error(`${provider} did not start listening on TCP port ${runtimeLauncher.port}.${logs ? ` Output: ${logs}` : ` Check that systemd user services, ${runtimeLauncher.binary}, and ${runtimeLauncher.command} are available.`}`);
    }

    return { reused: false };
}
