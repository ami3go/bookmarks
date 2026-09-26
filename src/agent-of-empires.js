import { cleanLauncherText, resolveExecutablePath, sleep } from './launcher-runtime.js';

export const AGENT_OF_EMPIRES_DEFAULT_PORT = 8080;

function commandBasename(value) {
    return cleanLauncherText(value).split('/').pop()?.toLowerCase() || '';
}

function stripHostBrackets(value) {
    return String(value || '').trim().replace(/^\[|\]$/g, '');
}

function hostnameLooksLikeIp(value) {
    const host = stripHostBrackets(value).split('%')[0];
    if (!host)
        return false;
    if (host.includes(':'))
        return /^[0-9a-f:.]+$/i.test(host);
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function launcher(service) {
    return service?.applicationLauncher || {};
}

export function isAgentOfEmpiresService(service) {
    if (service?.type !== 'application-launcher')
        return false;
    if (service?.integration === 'agent-of-empires')
        return true;

    const app = launcher(service);
    const args = Array.isArray(app.args) ? app.args : [];
    const urlArgs = Array.isArray(app.urlArgs) ? app.urlArgs : [];
    return commandBasename(app.command) === 'aoe'
        && args[0] === 'serve'
        && commandBasename(app.urlCommand || app.command) === 'aoe'
        && urlArgs[0] === 'url';
}

async function aoeExecutable(cockpit, service) {
    return resolveExecutablePath(cockpit, launcher(service).command || 'aoe');
}

function extractFirstUrl(output) {
    const match = String(output || '').match(/https?:\/\/[^\s]+/i);
    if (!match)
        return null;
    try {
        return new URL(match[0].replace(/[),.;]+$/, '')).toString();
    } catch (_) {
        return null;
    }
}

export function rewriteAgentOfEmpiresUrl(value, hostname) {
    const parsed = new URL(value);
    const host = stripHostBrackets(hostname);
    if (host)
        parsed.hostname = host.includes(':') ? `[${host}]` : host;
    return parsed.toString();
}

async function readUrl(cockpit, executable, hostname) {
    try {
        const output = await cockpit.spawn([executable, 'url'], { err: 'ignore' });
        const url = extractFirstUrl(output);
        return url ? rewriteAgentOfEmpiresUrl(url, hostname) : null;
    } catch (_) {
        return null;
    }
}

async function aoeRunningWithExecutable(cockpit, executable) {
    try {
        await cockpit.spawn([executable, 'serve', '--status'], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

async function waitForUrl(cockpit, executable, hostname, attempts) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const url = await readUrl(cockpit, executable, hostname);
        if (url)
            return url;
        if (attempt + 1 < attempts)
            await sleep(500);
    }
    return null;
}

export async function agentOfEmpiresRunning(cockpit, service) {
    if (!cockpit?.spawn)
        return false;
    const executable = await aoeExecutable(cockpit, service);
    return aoeRunningWithExecutable(cockpit, executable);
}

export async function startAgentOfEmpires(cockpit, service, hostname = '') {
    if (!cockpit?.spawn)
        throw new Error('Cockpit command execution is unavailable.');

    const executable = await aoeExecutable(cockpit, service);
    const app = launcher(service);
    const timeoutSeconds = Number(app.startupTimeoutSeconds);
    const attempts = Math.max(1, Math.ceil((Number.isFinite(timeoutSeconds) ? timeoutSeconds : 20) * 2));

    // The AoE daemon owns its own lifecycle. Always ask it whether it is
    // running before considering a new start; a transient `aoe url` failure
    // must never turn into a second daemon start and a misleading port-8080
    // conflict.
    if (await aoeRunningWithExecutable(cockpit, executable)) {
        const existingUrl = await waitForUrl(cockpit, executable, hostname, attempts);
        if (existingUrl)
            return { reused: true, url: existingUrl };
        throw new Error('Agent of Empires is running but "aoe url" did not return a usable token URL.');
    }

    const configuredPort = Number(app.port);
    const args = ['serve', '--host', '0.0.0.0', '--daemon'];
    if (Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort !== AGENT_OF_EMPIRES_DEFAULT_PORT)
        args.push('--port', String(configuredPort));

    const browserHost = stripHostBrackets(hostname);
    if (browserHost && browserHost !== 'localhost' && !hostnameLooksLikeIp(browserHost))
        args.push('--allowed-host', browserHost);

    await cockpit.spawn([executable, ...args], { err: 'message' });

    const url = await waitForUrl(cockpit, executable, hostname, attempts);
    if (url)
        return { reused: false, url };

    throw new Error('Agent of Empires started but did not publish a usable token URL through "aoe url".');
}

export async function stopAgentOfEmpires(cockpit, service) {
    if (!cockpit?.spawn)
        throw new Error('Cockpit command execution is unavailable.');
    const executable = await aoeExecutable(cockpit, service);
    if (!await aoeRunningWithExecutable(cockpit, executable))
        return;
    await cockpit.spawn([executable, 'serve', '--stop'], { err: 'message' });
}
