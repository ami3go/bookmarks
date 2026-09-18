import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildTransientUnitArguments,
    cleanLauncherId,
    cleanLauncherText,
    formatArgumentLines,
    parseArgumentLines,
    probeAddress,
    resolveExecutablePath,
} from '../src/launcher-runtime.js';

test('normalizes shared launcher identifiers and argument lines', () => {
    assert.equal(cleanLauncherId(' app / one '), 'app---one');
    assert.equal(cleanLauncherText('  hello\nworld\0 '), 'helloworld');
    assert.deepEqual(parseArgumentLines('--one\nvalue with spaces\n\n--two'), ['--one', 'value with spaces', '--two']);
    assert.equal(formatArgumentLines(['--one', 'value with spaces']), '--one\nvalue with spaces');
});

test('uses loopback for wildcard readiness probes', () => {
    assert.equal(probeAddress('0.0.0.0'), '127.0.0.1');
    assert.equal(probeAddress('::'), '127.0.0.1');
    assert.equal(probeAddress('192.168.1.20'), '192.168.1.20');
});

test('builds consistent transient systemd command prefixes', () => {
    assert.deepEqual(buildTransientUnitArguments({
        unit: 'example.service',
        runtimeSeconds: 90,
        description: 'Example',
        command: ['/usr/bin/example', '--flag'],
    }), [
        'systemd-run',
        '--user',
        '--unit=example.service',
        '--collect',
        '--quiet',
        '--service-type=exec',
        '--property=RuntimeMaxSec=90',
        '--property=KillMode=control-group',
        '--description=Example',
        '--',
        '/usr/bin/example',
        '--flag',
    ]);
});


test('resolves executable paths with whereis and falls back safely', async () => {
    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            return 'aoe: /usr/local/bin/aoe /usr/bin/aoe\n';
        },
    };

    assert.equal(await resolveExecutablePath(cockpit, 'aoe'), '/usr/local/bin/aoe');
    assert.deepEqual(calls, [['whereis', '-b', 'aoe']]);
    assert.equal(await resolveExecutablePath(cockpit, '/opt/aoe/bin/aoe'), '/opt/aoe/bin/aoe');
    assert.equal(await resolveExecutablePath(null, 'aoe'), 'aoe');

    const missing = {
        spawn: async () => 'missing:\n',
    };
    assert.equal(await resolveExecutablePath(missing, 'missing'), 'missing');

    const failed = {
        spawn: async () => { throw new Error('whereis unavailable'); },
    };
    assert.equal(await resolveExecutablePath(failed, 'aoe'), 'aoe');
});
