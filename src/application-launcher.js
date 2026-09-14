import { newBookmarkId } from './bookmarks.js';

export const APPLICATION_LAUNCHER_TYPE = 'application-launcher';
export const APPLICATION_LAUNCHER_EDIT_EVENT = 'cockpit-bookmarks:edit-application-launcher';
export const APPLICATION_LAUNCHER_PATH_PREFIX = '/cb-app-';

export const DEFAULT_APPLICATION_LAUNCHER = {
    command: '',
    args: [],
    bindHost: '0.0.0.0',
    port: 47300,
    autoStopMinutes: 120,
    startupTimeoutSeconds: 20,
    urlCommand: '',
    urlArgs: [],
    urlPattern: 'https?://[^\\s]+',
};

const sleep = milliseconds => new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));

function cleanId(value) {
    return String(value || '').trim().replace(/[^A-Za-z0-9-]/g, '-');
}

function cleanText(value) {
    return String(value || '').replace(/[\0\r\n]/g, '').trim();
}

export function parseApplicationArguments(value) {
    if (Array.isArray(value))
        return value.map(cleanText).filter(Boolean);
    return String(value || '')
        .split(/\r?\n/)
        .map(cleanText)
        .filter(Boolean);
}

export function formatApplicationArguments(value) {
    return parseApplicationArguments(value).join('\n');
}

export function applicationPath(id) {
    return `${APPLICATION_LAUNCHER_PATH_PREFIX}${cleanId(id)}/`;
}

export function applicationUrl(id, port) {
    return `http://{host}:${Number(port)}${applicationPath(id)}`;
}

export function applicationIdFromUrl(value) {
    try {
        const parsed = new URL(String(value || ''));
        const match = parsed.pathname.match(/^\/cb-app-([A-Za-z0-9-]+)\/?$/);
        return match?.[1] || null;
    } catch (_) {
        return null;
    }
}

export function applicationUnitName(id) {
    return `cockpit-bookmarks-app-${cleanId(id)}.service`;
}

export function normalizeApplicationLauncher(value = {}) {
    const port = Number(value.port);
    const autoStopMinutes = Number(value.autoStopMinutes);
    const startupTimeoutSeconds = Number(value.startupTimeoutSeconds);
    return {
        command: cleanText(value.command),
        args: parseApplicationArguments(value.args),
        bindHost: cleanText(value.bindHost) || DEFAULT_APPLICATION_LAUNCHER.bindHost,
        port: Number.isInteger(port) ? port : DEFAULT_APPLICATION_LAUNCHER.port,
        autoStopMinutes: Number.isFinite(autoStopMinutes) ? autoStopMinutes : DEFAULT_APPLICATION_LAUNCHER.autoStopMinutes,
        startupTimeoutSeconds: Number.isFinite(startupTimeoutSeconds) ? startupTimeoutSeconds : DEFAULT_APPLICATION_LAUNCHER.startupTimeoutSeconds,
        urlCommand: cleanText(value.urlCommand),
        urlArgs: parseApplicationArguments(value.urlArgs),
        urlPattern: cleanText(value.urlPattern) || DEFAULT_APPLICATION_LAUNCHER.urlPattern,
    };
}

export function applicationDraft(service = null, suggestedPort = DEFAULT_APPLICATION_LAUNCHER.port) {
    const launcher = normalizeApplicationLauncher(service?.applicationLauncher || {
        ...DEFAULT_APPLICATION_LAUNCHER,
        port: suggestedPort,
    });
    return {
        id: service?.id || '',
        name: String(service?.name || ''),
        command: launcher.command,
        args: formatApplicationArguments(launcher.args),
        bindHost: launcher.bindHost,
        port: String(launcher.port),
        autoStopMinutes: String(launcher.autoStopMinutes),
        startupTimeoutSeconds: String(launcher.startupTimeoutSeconds),
        urlCommand: launcher.urlCommand,
        urlArgs: formatApplicationArguments(launcher.urlArgs),
        urlPattern: launcher.urlPattern,
        icon: String(service?.icon || '🚀'),
        accent: String(service?.accent || 'orange'),
    };
}

export function agentOfEmpiresDraft(port = DEFAULT_APPLICATION_LAUNCHER.port) {
    return {
        ...applicationDraft(null, port),
        name: 'Agent of Empires',
        command: 'aoe',
        args: 'serve\n--host\n{bind}\n--port\n{port}\n--allowed-host\n{host}',
        bindHost: '0.0.0.0',
        urlCommand: 'aoe',
        urlArgs: 'url',
        icon: '🏛️',
        accent: 'orange',
    };
}

export function validateApplicationDraft(draft) {
    const errors = {};
    const port = Number(draft.port);
    const autoStopMinutes = Number(draft.autoStopMinutes);
    const startupTimeoutSeconds = Number(draft.startupTimeoutSeconds);

    if (!cleanText(draft.name))
        errors.name = 'Name is required.';
    if (!cleanText(draft.command))
        errors.command = 'Application command is required.';
    if (!cleanText(draft.bindHost) || /[\s/]/.test(cleanText(draft.bindHost)))
        errors.bindHost = 'Use a bind address such as 0.0.0.0, 127.0.0.1, ::, or ::1.';
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
        errors.port = 'Use an unprivileged TCP port from 1024 to 65535.';
    if (!Number.isInteger(autoStopMinutes) || autoStopMinutes < 1 || autoStopMinutes > 1440)
        errors.autoStopMinutes = 'Auto-stop must be between 1 and 1440 minutes.';
    if (!Number.isInteger(startupTimeoutSeconds) || startupTimeoutSeconds < 3 || startupTimeoutSeconds > 120)
        errors.startupTimeoutSeconds = 'Startup timeout must be between 3 and 120 seconds.';
    try {
        new RegExp(cleanText(draft.urlPattern) || DEFAULT_APPLICATION_LAUNCHER.urlPattern, 'g');
    } catch (_) {
        errors.urlPattern = 'URL pattern must be a valid regular expression.';
    }
    return errors;
}

function tagsForApplication(original, command) {
    const tags = Array.isArray(original?.tags) ? original.tags : [];
    const commandTag = cleanText(command).split('/').pop()?.toLowerCase() || '';
    return [...new Set([...tags, 'application', 'launcher', 'web-app', ...(commandTag ? [commandTag] : [])])];
}

export function buildApplicationService(draft, original = null) {
    const id = cleanId(original?.id || draft.id || newBookmarkId());
    const launcher = normalizeApplicationLauncher({
        command: draft.command,
        args: draft.args,
        bindHost: draft.bindHost,
        port: Number(draft.port),
        autoStopMinutes: Number(draft.autoStopMinutes),
        startupTimeoutSeconds: Number(draft.startupTimeoutSeconds),
        urlCommand: draft.urlCommand,
        urlArgs: draft.urlArgs,
        urlPattern: draft.urlPattern,
    });
    const service = {
        ...(original || {}),
        id,
        type: APPLICATION_LAUNCHER_TYPE,
        integration: 'application',
        name: cleanText(draft.name),
        url: applicationUrl(id, launcher.port),
        description: `On-demand web application: ${launcher.command}`,
        group: 'Applications',
        icon: cleanText(draft.icon) || '🚀',
        accent: cleanText(draft.accent) || 'orange',
        tags: tagsForApplication(original, launcher.command),
        applicationLauncher: launcher,
    };
    delete service.openMode;
    delete service.endpoints;
    delete service.statusCheck;
    return service;
}

export function expandApplicationTemplate(value, hostname, launcher) {
    return String(value || '')
        .replaceAll('{host}', String(hostname || ''))
        .replaceAll('{bind}', String(launcher?.bindHost || ''))
        .replaceAll('{port}', String(launcher?.port || ''));
}

export function buildApplicationSystemdRunArguments(service, hostname = '') {
    const launcher = normalizeApplicationLauncher(service?.applicationLauncher);
    const runtimeSeconds = Math.round(launcher.autoStopMinutes * 60);
    const command = expandApplicationTemplate(launcher.command, hostname, launcher);
    const args = launcher.args.map(arg => expandApplicationTemplate(arg, hostname, launcher));
    return [
        'systemd-run',
        '--user',
        `--unit=${applicationUnitName(service?.id)}`,
        '--collect',
        '--quiet',
        '--service-type=exec',
        `--property=RuntimeMaxSec=${runtimeSeconds}`,
        '--property=KillMode=control-group',
        `--description=Cockpit Bookmarks application: ${cleanText(service?.name) || command}`,
        '--',
        command,
        ...args,
    ];
}

function probeAddress(value) {
    const address = cleanText(value).replace(/^\[|\]$/g, '');
    if (!address || address === '0.0.0.0' || address === '::')
        return '127.0.0.1';
    return address;
}

async function tcpReady(cockpit, launcher) {
    try {
        await cockpit.spawn([
            'timeout', '1', 'bash', '-c',
            'exec 3<>/dev/tcp/"$1"/"$2"',
            '_', probeAddress(launcher.bindHost), String(launcher.port),
        ], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

async function unitActive(cockpit, service) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'is-active', '--quiet', applicationUnitName(service.id)], { err: 'ignore' });
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

async function journalOutput(cockpit, service) {
    try {
        return await cockpit.spawn([
            'journalctl', '--user', '-u', applicationUnitName(service.id),
            '--no-pager', '-o', 'cat', '-n', '120',
        ], { err: 'ignore' });
    } catch (_) {
        return '';
    }
}

export function extractApplicationUrl(output, pattern = DEFAULT_APPLICATION_LAUNCHER.urlPattern) {
    const text = String(output || '').replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
    let regex;
    try {
        regex = new RegExp(pattern || DEFAULT_APPLICATION_LAUNCHER.urlPattern, 'g');
    } catch (_) {
        return null;
    }
    const matches = [...text.matchAll(regex)];
    for (let index = matches.length - 1; index >= 0; index -= 1) {
        const candidate = String(matches[index][1] || matches[index][0] || '').replace(/[),.;]+$/, '');
        try {
            const parsed = new URL(candidate);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:')
                return parsed.toString();
        } catch (_) {
            // Try the previous match.
        }
    }
    return null;
}

export function rewriteApplicationUrl(value, browserHostname) {
    const parsed = new URL(value);
    const current = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const local = current === 'localhost' || current === '0.0.0.0' || current === '::' || current === '::1' || current.startsWith('127.');
    if (local && browserHostname)
        parsed.hostname = String(browserHostname).replace(/^\[|\]$/g, '');
    return parsed.toString();
}

async function urlCommandOutput(cockpit, launcher, hostname) {
    if (!launcher.urlCommand)
        return '';
    const command = expandApplicationTemplate(launcher.urlCommand, hostname, launcher);
    const args = launcher.urlArgs.map(arg => expandApplicationTemplate(arg, hostname, launcher));
    try {
        return await cockpit.spawn([command, ...args], { err: 'ignore' });
    } catch (_) {
        return '';
    }
}

export async function waitForApplicationUrl(cockpit, service, hostname = '') {
    const launcher = normalizeApplicationLauncher(service?.applicationLauncher);
    const attempts = Math.max(1, Math.ceil(launcher.startupTimeoutSeconds * 2));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const commandOutput = await urlCommandOutput(cockpit, launcher, hostname);
        const logOutput = commandOutput || await journalOutput(cockpit, service);
        const url = extractApplicationUrl(logOutput, launcher.urlPattern);
        if (url)
            return rewriteApplicationUrl(url, hostname);

        if (attempt > 1 && !await unitActive(cockpit, service))
            break;
        if (attempt + 1 < attempts)
            await sleep(500);
    }
    return null;
}

export async function stopApplicationLauncher(cockpit, service) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'stop', applicationUnitName(service.id)], { err: 'message' });
    } catch (error) {
        const text = cockpit?.message ? cockpit.message(error) : String(error || '');
        if (!/(not loaded|not found|inactive)/i.test(text))
            throw error;
    }
}

export async function startApplicationLauncher(cockpit, service, hostname = '') {
    if (!cockpit?.spawn)
        throw new Error('Cockpit command execution is unavailable.');
    if (service?.type !== APPLICATION_LAUNCHER_TYPE)
        throw new Error('This bookmark is not an application launcher.');

    const launcher = normalizeApplicationLauncher(service.applicationLauncher);
    const validation = validateApplicationDraft({
        name: service.name,
        command: launcher.command,
        bindHost: launcher.bindHost,
        port: launcher.port,
        autoStopMinutes: launcher.autoStopMinutes,
        startupTimeoutSeconds: launcher.startupTimeoutSeconds,
        urlPattern: launcher.urlPattern,
    });
    if (Object.keys(validation).length)
        throw new Error(Object.values(validation)[0]);

    if (await unitActive(cockpit, service)) {
        const existingUrl = await waitForApplicationUrl(cockpit, service, hostname);
        if (existingUrl)
            return { reused: true, url: existingUrl };
        if (await tcpReady(cockpit, launcher))
            throw new Error('Application is running but its browser URL could not be recovered. Check the URL command/pattern.');
        await stopApplicationLauncher(cockpit, service);
    }

    if (await portAlreadyListening(cockpit, launcher.port))
        throw new Error(`TCP port ${launcher.port} is already in use by another service.`);

    await cockpit.spawn(buildApplicationSystemdRunArguments(service, hostname), { err: 'message' });
    const url = await waitForApplicationUrl(cockpit, service, hostname);
    if (!url) {
        const logs = String(await journalOutput(cockpit, service) || '').trim().split(/\r?\n/).slice(-4).join(' | ');
        await stopApplicationLauncher(cockpit, service).catch(() => {});
        throw new Error(`Application did not publish a usable browser URL${logs ? `: ${logs}` : '.'}`);
    }
    return { reused: false, url };
}

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

export function installApplicationLauncherOpenInterceptor(cockpit = window.cockpit) {
    if (window.__cockpitBookmarksApplicationLauncherInstalled)
        return;
    window.__cockpitBookmarksApplicationLauncherInstalled = true;

    const nativeOpen = window.open.bind(window);
    window.open = function interceptedApplicationOpen(url, target, features) {
        const launcherId = applicationIdFromUrl(url);
        if (!launcherId)
            return nativeOpen(url, target, features);

        const tab = nativeOpen('about:blank', '_blank');
        if (!tab)
            return null;
        try { tab.opener = null; } catch (_) { /* best effort */ }
        writeTabMessage(tab, 'Starting application…', 'Starting the configured application on the Cockpit host and waiting for its browser URL.');

        import('./cockpit-config.js').then(({ readConfiguration }) => readConfiguration())
            .then(config => {
                const service = config.services.find(item => item?.id === launcherId && item?.type === APPLICATION_LAUNCHER_TYPE);
                if (!service)
                    throw new Error('The application launcher bookmark no longer exists.');
                return startApplicationLauncher(cockpit, service, window.location.hostname);
            })
            .then(result => {
                if (!tab.closed)
                    tab.location.replace(result.url);
            })
            .catch(error => {
                const message = cockpit?.message ? cockpit.message(error) : String(error?.message || error || 'Unknown error');
                writeTabMessage(tab, 'Could not start application', message);
            });
        return tab;
    };
}
