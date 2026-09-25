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

export async function agentOfEmpiresRunning(cockpit, service) {
    if (!cockpit?.spawn)
        return false;
    try {
        const executable = await aoeExecutable(cockpit, service);
        await cockpit.spawn([executable, 'serve', '--status'], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

export async function startAgentOfEmpires(cockpit, service, hostname = '') {
    if (!cockpit?.spawn)
        throw new Error('Cockpit command execution is unavailable.');

    const executable = await aoeExecutable(cockpit, service);
    const existingUrl = await readUrl(cockpit, executable, hostname);
    if (existingUrl)
        return { reused: true, url: existingUrl };

    const app = launcher(service);
    const configuredPort = Number(app.port);
    const args = ['serve', '--host', '0.0.0.0', '--daemon'];
    if (Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort !== AGENT_OF_EMPIRES_DEFAULT_PORT)
        args.push('--port', String(configuredPort));

    const browserHost = stripHostBrackets(hostname);
    if (browserHost && browserHost !== 'localhost' && !hostnameLooksLikeIp(browserHost))
        args.push('--allowed-host', browserHost);

    await cockpit.spawn([executable, ...args], { err: 'message' });

    const timeoutSeconds = Number(app.startupTimeoutSeconds);
    const attempts = Math.max(1, Math.ceil((Number.isFinite(timeoutSeconds) ? timeoutSeconds : 20) * 2));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const url = await readUrl(cockpit, executable, hostname);
        if (url)
            return { reused: false, url };
        if (attempt + 1 < attempts)
            await sleep(500);
    }

    throw new Error('Agent of Empires started but did not publish a usable token URL through "aoe url".');
}

export async function stopAgentOfEmpires(cockpit, service) {
    if (!cockpit?.spawn)
        throw new Error('Cockpit command execution is unavailable.');
    const executable = await aoeExecutable(cockpit, service);
    if (!await agentOfEmpiresRunning(cockpit, service))
        return;
    await cockpit.spawn([executable, 'serve', '--stop'], { err: 'message' });
}
