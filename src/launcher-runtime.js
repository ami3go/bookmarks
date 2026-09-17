export const sleep = milliseconds => new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));

export function cleanLauncherId(value) {
    return String(value || '').trim().replace(/[^A-Za-z0-9-]/g, '-');
}

export function cleanLauncherText(value) {
    return String(value || '').replace(/[\0\r\n]/g, '').trim();
}

export function parseArgumentLines(value) {
    if (Array.isArray(value))
        return value.map(cleanLauncherText).filter(Boolean);
    return String(value || '')
        .split(/\r?\n/)
        .map(cleanLauncherText)
        .filter(Boolean);
}

export function formatArgumentLines(value) {
    return parseArgumentLines(value).join('\n');
}

export function probeAddress(value) {
    const address = cleanLauncherText(value).replace(/^\[|\]$/g, '');
    if (!address || address === '0.0.0.0' || address === '::')
        return '127.0.0.1';
    return address;
}

export function buildTransientUnitArguments({ unit, runtimeSeconds, description, command }) {
    const args = [
        'systemd-run',
        '--user',
        `--unit=${unit}`,
        '--collect',
        '--quiet',
        '--service-type=exec',
    ];

    if (Number.isFinite(runtimeSeconds) && runtimeSeconds > 0)
        args.push(`--property=RuntimeMaxSec=${Math.round(runtimeSeconds)}`);

    args.push(
        '--property=KillMode=control-group',
        `--description=${description}`,
        '--',
        ...command,
    );
    return args;
}

export async function userUnitActive(cockpit, unit) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'is-active', '--quiet', unit], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

export async function stopUserUnit(cockpit, unit) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'stop', unit], { err: 'message' });
    } catch (error) {
        const text = cockpit?.message ? cockpit.message(error) : String(error || '');
        if (!/(not loaded|not found|inactive)/i.test(text))
            throw error;
    }
}

export async function tcpPortReady(cockpit, address, port) {
    try {
        await cockpit.spawn([
            'timeout', '1', 'bash', '-c',
            'exec 3<>/dev/tcp/"$1"/"$2"',
            '_', probeAddress(address), String(port),
        ], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

export async function tcpPortListening(cockpit, port) {
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

export async function readUserUnitJournal(cockpit, unit, lines = 120) {
    try {
        return await cockpit.spawn([
            'journalctl', '--user', '-u', unit,
            '--no-pager', '-o', 'cat', '-n', String(lines),
        ], { err: 'ignore' });
    } catch (_) {
        return '';
    }
}
