export const sleep = milliseconds => new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));

export function cleanLauncherId(value) {
    return String(value || '').trim().replace(/[^A-Za-z0-9-]/g, '-');
}

export function cleanLauncherText(value) {
    return String(value || '').replace(/[\0\r\n]/g, '').trim();
}

export function errorMessage(cockpit, error) {
    try {
        return cockpit?.message ? cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export async function resolveExecutablePath(cockpit, executable) {
    const command = cleanLauncherText(executable);
    if (!command || command.includes('/'))
        return command;
    if (!cockpit?.spawn)
        throw new Error(`Cannot resolve executable ${command}: Cockpit command execution is unavailable.`);

    const script = [
        'candidate="$(command -v -- "$1" 2>/dev/null || true)"',
        'if [ -n "$candidate" ] && [ -f "$candidate" ] && [ -x "$candidate" ]; then',
        '  printf "%s\\n" "$candidate"',
        'fi',
    ].join('\n');
    const output = await cockpit.spawn(
        ['bash', '--noprofile', '--norc', '-c', script, '_', command],
        { err: 'ignore' }
    );
    const candidate = cleanLauncherText(String(output || '').split(/\r?\n/)[0]);
    if (candidate.startsWith('/'))
        return candidate;

    let searchPath = '';
    try {
        searchPath = cleanLauncherText(await cockpit.spawn(
            ['bash', '--noprofile', '--norc', '-c', 'printf "%s" "$PATH"'],
            { err: 'ignore' }
        ));
    } catch (_) {
        // The command-not-found error is still useful without PATH details.
    }
    throw new Error(`Executable "${command}" was not found${searchPath ? ` in PATH ${searchPath}` : ' in the Cockpit session PATH'}.`);
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

export function buildTransientUnitArguments({ unit, runtimeSeconds, description, command, outputFile = '' }) {
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
    if (outputFile) {
        args.push(`--property=StandardOutput=file:${outputFile}`);
        args.push('--property=StandardError=inherit');
    }

    args.push(
        '--property=KillMode=control-group',
        `--description=${description}`,
        '--',
        ...command,
    );
    return args;
}

export async function userRuntimeDirectory(cockpit) {
    const uid = cleanLauncherText(await cockpit.spawn(['id', '-u'], { err: 'message' }));
    if (!/^\d+$/.test(uid))
        throw new Error('Could not determine the current user ID for launcher output.');
    return `/run/user/${uid}/cockpit-bookmarks`;
}

export async function launcherOutputFile(cockpit, unit) {
    const directory = await userRuntimeDirectory(cockpit);
    const filename = cleanLauncherText(unit).replace(/[^A-Za-z0-9_.-]/g, '-');
    return `${directory}/${filename}.log`;
}

export async function prepareLauncherOutput(cockpit, unit) {
    const directory = await userRuntimeDirectory(cockpit);
    const filename = cleanLauncherText(unit).replace(/[^A-Za-z0-9_.-]/g, '-');
    const path = `${directory}/${filename}.log`;
    await cockpit.spawn(['install', '-d', '-m', '0700', directory], { err: 'message' });
    await cockpit.spawn(['rm', '-f', '--', path], { err: 'message' });
    return path;
}

export async function readLauncherOutput(cockpit, unit, maxBytes = 65536) {
    try {
        const path = await launcherOutputFile(cockpit, unit);
        return await cockpit.spawn(['tail', '-c', String(Math.max(1, maxBytes)), '--', path], { err: 'ignore' });
    } catch (_) {
        return '';
    }
}

export async function userUnitActive(cockpit, unit) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'is-active', '--quiet', unit], { err: 'ignore' });
        return true;
    } catch (_) {
        return false;
    }
}

export async function userUnitState(cockpit, unit) {
    try {
        const output = cleanLauncherText(await cockpit.spawn([
            'systemctl', '--user', 'show', '--property=ActiveState', '--value', '--', unit,
        ], { err: 'ignore' }));
        if (output === 'active')
            return 'running';
        if (output === 'failed')
            return 'failed';
        return 'stopped';
    } catch (_) {
        return 'stopped';
    }
}

export async function stopUserUnit(cockpit, unit) {
    try {
        await cockpit.spawn(['systemctl', '--user', 'stop', unit], { err: 'message' });
    } catch (error) {
        const text = errorMessage(cockpit, error);
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
