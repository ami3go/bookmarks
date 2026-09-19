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

test('adds per-run output capture only when requested', () => {
    const args = buildTransientUnitArguments({
        unit: 'example.service',
        runtimeSeconds: 0,
        description: 'Example',
        command: ['/usr/bin/example'],
        outputFile: '/run/user/1000/cockpit-bookmarks/example.log',
    });
    assert.ok(args.includes('--property=StandardOutput=file:/run/user/1000/cockpit-bookmarks/example.log'));
    assert.ok(args.includes('--property=StandardError=inherit'));
    assert.equal(args.some(arg => arg.startsWith('--property=RuntimeMaxSec=')), false);
});

test('resolves bare executables through command -v in Cockpit PATH', async () => {
    const calls = [];
    const cockpit = {
        spawn: async (args, options) => {
            calls.push({ args, options });
            assert.equal(args[0], 'bash');
            assert.ok(args.includes('aoe'));
            return '/usr/local/bin/aoe\n';
        },
    };

    assert.equal(await resolveExecutablePath(cockpit, 'aoe'), '/usr/local/bin/aoe');
    assert.equal(calls.length, 1);
    assert.match(calls[0].args[4], /command -v/);
});

test('leaves explicitly configured paths untouched', async () => {
    let called = false;
    const cockpit = { spawn: async () => { called = true; } };
    assert.equal(await resolveExecutablePath(cockpit, '/opt/aoe/bin/aoe'), '/opt/aoe/bin/aoe');
    assert.equal(called, false);
});

test('fails with the searched PATH when a bare executable is missing', async () => {
    let calls = 0;
    const cockpit = {
        spawn: async args => {
            calls += 1;
            return calls === 1 ? '' : '/usr/local/bin:/usr/bin:/bin';
        },
    };

    await assert.rejects(
        resolveExecutablePath(cockpit, 'missing-app'),
        /Executable "missing-app" was not found in PATH \/usr\/local\/bin:\/usr\/bin:\/bin/
    );
    assert.equal(calls, 2);
});

test('fails clearly when Cockpit command execution is unavailable', async () => {
    await assert.rejects(resolveExecutablePath(null, 'aoe'), /Cockpit command execution is unavailable/);
});
