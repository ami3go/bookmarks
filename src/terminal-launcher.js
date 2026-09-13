import { expandUrl, newBookmarkId } from './bookmarks.js';

// Keep the legacy type/path/unit names so existing GoTTY launcher bookmarks and
// copied URLs remain valid. The provider field selects the actual terminal
// server for both old and new launchers.
export const GOTTY_LAUNCHER_TYPE = 'gotty-launcher';
export const TERMINAL_LAUNCHER_TYPE = GOTTY_LAUNCHER_TYPE;
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
    autoStopMinutes: 30,
};
export const DEFAULT_GOTTY_LAUNCHER = DEFAULT_TERMINAL_LAUNCHER;

const sleep = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

function cleanId(value) {
    return String(value || '').trim().replace(/[^A-Za-z0-9-]/g, '-');
}

function cleanText(value) {
    return String(value || '').replace(/[\0\r\n]/g, '').trim();
}

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
    const safeId = cleanId(id);
    return `${GOTTY_LAUNCHER_PATH_PREFIX}${safeId}/`;
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
    return `cockpit-bookmarks-gotty-${cleanId(id)}.service`;
}

export function parseLauncherArguments(value) {
    if (Array.isArray(value))
        return value.map(cleanText).filter(Boolean);
    return String(value || '')
        .split(/\r?\n/)
        .map(cleanText)
        .filter(Boolean);
}

export function formatLauncherArguments(value) {
    return parseLauncherArguments(value).join('\n');
}

export function normalizeTerminalLauncher(value = {}) {
    const provider = normalizeTerminalProvider(value.provider);
    const port = Number(value.port);
    const autoStopMinutes = Number(value.autoStopMinutes);
    return {
        provider,
        binary: cleanText(value.binary) || defaultBinaryForProvider(provider),
        command: cleanText(value.command),
        args: parseLauncherArguments(value.args),
        port: Number.isInteger(port) ? port : DEFAULT_TERMINAL_LAUNCHER.port,
        address: cleanText(value.address) || DEFAULT_TERMINAL_LAUNCHER.address,
        autoStopMinutes: Number.isFinite(autoStopMinutes) ? autoStopMinutes : DEFAULT_TERMINAL_LAUNCHER.autoStopMinutes,
    };
}

export const normalizeGottyLauncher = normalizeTerminalLauncher;

export function launcherDraft(service = null, suggestedPort = DEFAULT_TERMINAL_LAUNCHER.port) {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher || {
        ...DEFAULT_TERMINAL_LAUNCHER,
        port: suggestedPort,
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
    const address = cleanText(draft.address);

    if (!cleanText(draft.name))
        errors.name = 'Name is required.';
    if (!cleanText(draft.command))
        errors.command = 'Application command is required.';
    if (!cleanText(draft.binary))
        errors.binary = `${terminalProviderLabel(provider)} executable is required.`;
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
        errors.port = 'Use an unprivileged TCP port from 1024 to 65535.';
    if (!address || /[\s/]/.test(address))
        errors.address = 'Use a listen address such as 127.0.0.1, 0.0.0.0, ::1, or ::.';
    if (!Number.isInteger(autoStopMinutes) || autoStopMinutes < 1 || autoStopMinutes > 720)
        errors.autoStopMinutes = 'Auto-stop must be between 1 and 720 minutes.';

    return errors;
}

function tagsForLauncher(original, command, provider) {
    const tags = Array.isArray(original?.tags) ? original.tags : [];
    const commandTag = cleanText(command).split('/').pop()?.toLowerCase() || '';
    const withoutProvider = tags.filter(tag => !['gotty', 'ttyd'].includes(String(tag).toLowerCase()));
    return [...new Set([...withoutProvider, provider, 'launcher', 'terminal', ...(commandTag ? [commandTag] : [])])];
}

export function buildLauncherService(draft, original = null) {
    const id = cleanId(original?.id || draft.id || newBookmarkId());
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
        name: cleanText(draft.name),
        url: launcherUrl(id, launcher.port),
        description: `On-demand ${providerLabel} launcher for ${launcher.command}`,
        group: cleanText(draft.group) || 'Terminal',
        icon: cleanText(draft.icon) || '⌨️',
        accent: cleanText(draft.accent) || 'teal',
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
    const address = cleanText(value).toLowerCase();
    return !(address === '127.0.0.1' || address === 'localhost' || address === '::1' || address.startsWith('127.'));
}

export function probeAddress(value) {
    const address = cleanText(value).replace(/^\[|\]$/g, '');
    if (!address || address === '0.0.0.0' || address === '::')
        return '127.0.0.1';
    return address;
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

export function buildSystemdRunArguments(service, hostname = '') {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher);
    const runtimeSeconds = Math.round(launcher.autoStopMinutes * 60);
    const unit = launcherUnitName(service?.id);
    const command = expandLauncherHost(launcher.command, hostname);
    return [
        'systemd-run',
        '--user',
        `--unit=${unit}`,
        '--collect',
        '--quiet',
        '--service-type=exec',
        `--property=RuntimeMaxSec=${runtimeSeconds}`,
        '--property=KillMode=control-group',
        `--description=Cockpit Bookmarks ${terminalProviderLabel(launcher.provider)}: ${cleanText(service?.name) || command}`,
        '--',
        ...providerArguments(launcher, service, hostname),
    ];
}

async function unitActive(cockpit, service) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'is-active', '--quiet', launcherUnitName(service.id)], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

async function tcpReady(cockpit, launcher) {
    try {
        await cockpit.spawn([
            'timeout', '1', 'bash', '-c',
            'exec 3<>/dev/tcp/"$1"/"$2"',
            '_', probeAddress(launcher.address), String(launcher.port),
        ], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

async function portAlreadyListening(cockpit, port) {
    try {
        const output = await cockpit.spawn(['ss', '-H', '-ltn'], { err: 'ignore' });
        return String(output || '').split(/\r?\n/).some(line => {
            const endpoint = line.trim().split(/\s+/)[3] || '';
            return endpoint.endsWith(`:${port}`);
        });
    } catch (_) {
        return false;
    }
}

export async function waitForLauncher(cockpit, service, attempts = 28, intervalMs = 250, hostname = '') {
    const launcher = normalizeTerminalLauncher(service?.gottyLauncher);
    const address = expandLauncherHost(launcher.address, hostname);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (await tcpReady(cockpit, { ...launcher, address }))
            return true;
        if (attempt + 1 < attempts)
            await sleep(intervalMs);
    }
    return false;
}

export async function stopTerminalLauncher(cockpit, service) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'stop', launcherUnitName(service.id)], { err: 'message' });
    } catch (error) {
        const text = cockpit?.message ? cockpit.message(error) : String(error || '');
        if (!/(not loaded|not found|inactive)/i.test(text))
            throw error;
    }
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

    if (await unitActive(cockpit, service)) {
        if (await waitForLauncher(cockpit, service, 8, 250, hostname))
            return { reused: true };
        await stopTerminalLauncher(cockpit, service);
    }

    if (await portAlreadyListening(cockpit, launcher.port))
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

function writeTabMessage(tab, title, message) {
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
        // The tab may already have navigated away.
    }
}

export function installTerminalLauncherOpenInterceptor(cockpit = window.cockpit) {
    if (window.__cockpitBookmarksGottyLauncherInstalled)
        return;
    window.__cockpitBookmarksGottyLauncherInstalled = true;

    const nativeOpen = window.open.bind(window);
    window.open = function interceptedWindowOpen(url, target, features) {
        const launcherId = launcherIdFromUrl(url);
        if (!launcherId)
            return nativeOpen(url, target, features);

        const tab = nativeOpen('about:blank', '_blank');
        if (!tab)
            return null;
        try {
            tab.opener = null;
        } catch (_) {
            // Best effort; navigation still continues.
        }
        writeTabMessage(tab, 'Starting terminal…', 'Starting the configured terminal application on the Cockpit host.');

        import('./cockpit-config.js').then(({ readConfiguration }) => readConfiguration())
            .then(config => {
                const service = config.services.find(item => item?.id === launcherId && item?.type === TERMINAL_LAUNCHER_TYPE);
                if (!service)
                    throw new Error('The terminal launcher bookmark no longer exists.');
                return startTerminalLauncher(cockpit, service, window.location.hostname).then(() => service);
            })
            .then(service => {
                if (!tab.closed)
                    tab.location.replace(expandUrl(service.url, window.location.hostname));
            })
            .catch(error => {
                const message = cockpit?.message ? cockpit.message(error) : String(error?.message || error || 'Unknown error');
                writeTabMessage(tab, 'Could not start terminal', message);
            });

        return tab;
    };
}

export const installGoTTYLauncherOpenInterceptor = installTerminalLauncherOpenInterceptor;
