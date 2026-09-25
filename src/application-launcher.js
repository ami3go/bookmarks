import { newBookmarkId } from './bookmarks.js';
import {
    buildTransientUnitArguments,
    cleanLauncherId,
    cleanLauncherText,
    formatArgumentLines,
    parseArgumentLines,
    prepareLauncherOutput,
    readLauncherOutput,
    readUserUnitJournal,
    resolveExecutablePath,
    sleep,
    stopUserUnit,
    tcpPortListening,
    tcpPortReady,
    userUnitActive,
} from './launcher-runtime.js';

export const APPLICATION_LAUNCHER_TYPE = 'application-launcher';
export const APPLICATION_LAUNCHER_PATH_PREFIX = '/cb-app-';

export const DEFAULT_APPLICATION_LAUNCHER = {
    command: '',
    args: [],
    bindHost: '0.0.0.0',
    port: 47300,
    // 0 means no RuntimeMaxSec limit. The UI presents this as infinity.
    autoStopMinutes: 0,
    startupTimeoutSeconds: 20,
    urlCommand: '',
    urlArgs: [],
    urlPattern: 'https?://[^\\s]+',
};

export function parseApplicationArguments(value) {
    return parseArgumentLines(value);
}

export function formatApplicationArguments(value) {
    return formatArgumentLines(value);
}

export function applicationPath(id) {
    return `${APPLICATION_LAUNCHER_PATH_PREFIX}${cleanLauncherId(id)}/`;
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
    return `cockpit-bookmarks-app-${cleanLauncherId(id)}.service`;
}

export function normalizeApplicationLauncher(value = {}) {
    const port = Number(value.port);
    const autoStopMinutes = Number(value.autoStopMinutes);
    const startupTimeoutSeconds = Number(value.startupTimeoutSeconds);
    return {
        command: cleanLauncherText(value.command),
        args: parseApplicationArguments(value.args),
        bindHost: cleanLauncherText(value.bindHost) || DEFAULT_APPLICATION_LAUNCHER.bindHost,
        port: Number.isInteger(port) ? port : DEFAULT_APPLICATION_LAUNCHER.port,
        autoStopMinutes: Number.isInteger(autoStopMinutes) && autoStopMinutes >= 0
            ? autoStopMinutes
            : DEFAULT_APPLICATION_LAUNCHER.autoStopMinutes,
        startupTimeoutSeconds: Number.isFinite(startupTimeoutSeconds) ? startupTimeoutSeconds : DEFAULT_APPLICATION_LAUNCHER.startupTimeoutSeconds,
        urlCommand: cleanLauncherText(value.urlCommand),
        urlArgs: parseApplicationArguments(value.urlArgs),
        urlPattern: cleanLauncherText(value.urlPattern) || DEFAULT_APPLICATION_LAUNCHER.urlPattern,
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

    if (!cleanLauncherText(draft.name))
        errors.name = 'Name is required.';
    if (!cleanLauncherText(draft.command))
        errors.command = 'Application command is required.';
    if (!cleanLauncherText(draft.bindHost) || /[\s/]/.test(cleanLauncherText(draft.bindHost)))
        errors.bindHost = 'Use a bind address such as 0.0.0.0, 127.0.0.1, ::, or ::1.';
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
        errors.port = 'Use an unprivileged TCP port from 1024 to 65535.';
    if (!Number.isInteger(autoStopMinutes) || autoStopMinutes < 0 || autoStopMinutes > 1440)
        errors.autoStopMinutes = 'Choose no timeout or an auto-stop value from 1 to 1440 minutes.';
    if (!Number.isInteger(startupTimeoutSeconds) || startupTimeoutSeconds < 3 || startupTimeoutSeconds > 120)
        errors.startupTimeoutSeconds = 'Startup timeout must be between 3 and 120 seconds.';
    try {
        new RegExp(cleanLauncherText(draft.urlPattern) || DEFAULT_APPLICATION_LAUNCHER.urlPattern, 'g');
    } catch (_) {
        errors.urlPattern = 'URL pattern must be a valid regular expression.';
    }
    return errors;
}

function tagsForApplication(original, command) {
    const tags = Array.isArray(original?.tags) ? original.tags : [];
    const commandTag = cleanLauncherText(command).split('/').pop()?.toLowerCase() || '';
    return [...new Set([...tags, 'application', 'launcher', 'web-app', ...(commandTag ? [commandTag] : [])])];
}

export function buildApplicationService(draft, original = null) {
    const id = cleanLauncherId(original?.id || draft.id || newBookmarkId());
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
        name: cleanLauncherText(draft.name),
        url: applicationUrl(id, launcher.port),
        description: `On-demand web application: ${launcher.command}`,
        group: 'Applications',
        icon: cleanLauncherText(draft.icon) || '🚀',
        accent: cleanLauncherText(draft.accent) || 'orange',
        tags: tagsForApplication(original, launcher.command),
        applicationLauncher: launcher,
    };
    delete service.openMode;
    delete service.endpoints;
    delete service.statusCheck;
    return service;
}

export function stripHostBrackets(value) {
    return String(value || '').replace(/^\[|\]$/g, '');
}

export function expandApplicationTemplate(value, hostname, launcher) {
    return String(value || '')
        .replaceAll('{host}', stripHostBrackets(hostname))
        .replaceAll('{bind}', stripHostBrackets(launcher?.bindHost || ''))
        .replaceAll('{port}', String(launcher?.port || ''));
}

export function buildApplicationSystemdRunArguments(service, hostname = '', outputFile = '') {
    const launcher = normalizeApplicationLauncher(service?.applicationLauncher);
    const command = expandApplicationTemplate(launcher.command, hostname, launcher);
    const args = launcher.args.map(arg => expandApplicationTemplate(arg, hostname, launcher));
    return buildTransientUnitArguments({
        unit: applicationUnitName(service?.id),
        runtimeSeconds: launcher.autoStopMinutes > 0 ? launcher.autoStopMinutes * 60 : 0,
        description: `Cockpit Bookmarks application: ${cleanLauncherText(service?.name) || command}`,
        command: [command, ...args],
        outputFile,
    });
}

async function currentRunOutput(cockpit, service) {
    const unit = applicationUnitName(service.id);
    const output = await readLauncherOutput(cockpit, unit);
    if (String(output || '').trim())
        return output;
    // Units created by older releases wrote to the journal, so retain a
    // compatibility fallback while existing processes are still running.
    return readUserUnitJournal(cockpit, unit, 120);
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
    for (const match of matches) {
        const candidate = String(match[1] || match[0] || '').replace(/[),.;]+$/, '');
        try {
            const parsed = new URL(candidate);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:')
                return parsed.toString();
        } catch (_) {
            // Try the next match from this run.
        }
    }
    return null;
}

export function rewriteApplicationUrl(value, browserHostname) {
    const parsed = new URL(value);
    const current = stripHostBrackets(parsed.hostname).toLowerCase();
    const local = current === 'localhost' || current === '0.0.0.0' || current === '::' || current === '::1' || current.startsWith('127.');
    if (local && browserHostname) {
        const browserHost = stripHostBrackets(browserHostname);
        parsed.hostname = browserHost.includes(':') ? `[${browserHost}]` : browserHost;
    }
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
    const unit = applicationUnitName(service.id);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const commandOutput = await urlCommandOutput(cockpit, launcher, hostname);
        const logOutput = commandOutput || await currentRunOutput(cockpit, service);
        const url = extractApplicationUrl(logOutput, launcher.urlPattern);
        if (url)
            return rewriteApplicationUrl(url, hostname);

        if (attempt > 1 && !await userUnitActive(cockpit, unit))
            break;
        if (attempt + 1 < attempts)
            await sleep(500);
    }
    return null;
}

export async function stopApplicationLauncher(cockpit, service) {
    return stopUserUnit(cockpit, applicationUnitName(service.id));
}

async function runtimeApplicationService(cockpit, service, hostname) {
    const launcher = normalizeApplicationLauncher(service.applicationLauncher);
    const expandedCommand = expandApplicationTemplate(launcher.command, hostname, launcher);
    const command = await resolveExecutablePath(cockpit, expandedCommand);
    let urlCommand = launcher.urlCommand;
    if (urlCommand) {
        const expandedUrlCommand = expandApplicationTemplate(urlCommand, hostname, launcher);
        urlCommand = expandedUrlCommand === expandedCommand
            ? command
            : await resolveExecutablePath(cockpit, expandedUrlCommand);
    }
    return {
        ...service,
        applicationLauncher: {
            ...launcher,
            command,
            urlCommand,
        },
    };
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

    const unit = applicationUnitName(service.id);
    if (await userUnitActive(cockpit, unit)) {
        const existingUrl = await waitForApplicationUrl(cockpit, service, hostname);
        if (existingUrl)
            return { reused: true, url: existingUrl };
        if (await tcpPortReady(cockpit, launcher.bindHost, launcher.port))
            throw new Error('Application is running but its browser URL could not be recovered. Check the URL command/pattern.');
        await stopApplicationLauncher(cockpit, service);
    }

    if (await tcpPortListening(cockpit, launcher.port))
        throw new Error(`TCP port ${launcher.port} is already in use by another service.`);

    const runtimeService = await runtimeApplicationService(cockpit, service, hostname);
    const outputFile = await prepareLauncherOutput(cockpit, unit);
    await cockpit.spawn(buildApplicationSystemdRunArguments(runtimeService, hostname, outputFile), { err: 'message' });
    const url = await waitForApplicationUrl(cockpit, runtimeService, hostname);
    if (!url) {
        const logs = String(await currentRunOutput(cockpit, runtimeService) || '').trim().split(/\r?\n/).slice(-4).join(' | ');
        await stopApplicationLauncher(cockpit, runtimeService).catch(() => {});
        throw new Error(`Application did not publish a usable browser URL${logs ? `: ${logs}` : '.'}`);
    }
    return { reused: false, url };
}
