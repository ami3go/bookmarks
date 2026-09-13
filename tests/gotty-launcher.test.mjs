import test from 'node:test';
import assert from 'node:assert/strict';

import {
    GOTTY_LAUNCHER_TYPE,
    buildLauncherService,
    buildSystemdRunArguments,
    expandLauncherHost,
    formatLauncherArguments,
    isNetworkExposedAddress,
    launcherIdFromUrl,
    launcherPath,
    launcherUnitName,
    launcherUrl,
    parseLauncherArguments,
    validateLauncherDraft,
} from '../src/gotty-launcher.js';

const BASE_DRAFT = {
    name: 'MC',
    binary: 'gotty',
    command: 'mc',
    args: '',
    port: '8085',
    address: '127.0.0.1',
    autoStopMinutes: '30',
    group: 'Terminal',
    icon: '📁',
    accent: 'teal',
};

test('builds deterministic launcher paths and recognizes launcher URLs', () => {
    assert.equal(launcherPath('abc-123'), '/cb-gotty-abc-123/');
    assert.equal(launcherUrl('abc-123', 8085), 'http://{host}:8085/cb-gotty-abc-123/');
    assert.equal(launcherIdFromUrl('http://mini-pc.local:8085/cb-gotty-abc-123/'), 'abc-123');
    assert.equal(launcherIdFromUrl('http://mini-pc.local:8085/other/'), null);
    assert.equal(launcherUnitName('abc-123'), 'cockpit-bookmarks-gotty-abc-123.service');
});

test('stores MC as an on-demand GoTTY launcher bookmark', () => {
    const service = buildLauncherService({ ...BASE_DRAFT, id: 'mc-test-id' });
    assert.equal(service.id, 'mc-test-id');
    assert.equal(service.type, GOTTY_LAUNCHER_TYPE);
    assert.equal(service.integration, 'gotty');
    assert.equal(service.name, 'MC');
    assert.equal(service.url, 'http://{host}:8085/cb-gotty-mc-test-id/');
    assert.equal(service.gottyLauncher.command, 'mc');
    assert.deepEqual(service.gottyLauncher.args, []);
    assert.equal(service.gottyLauncher.autoStopMinutes, 30);
    assert.ok(service.tags.includes('gotty'));
    assert.ok(service.tags.includes('mc'));
    assert.equal(service.openMode, undefined);
});

test('passes application parameters as individual argv entries without shell parsing', () => {
    const service = buildLauncherService({
        ...BASE_DRAFT,
        id: 'mc-args',
        command: 'mc',
        args: '--nocolor\n/home/user/My Files',
        address: '0.0.0.0',
        autoStopMinutes: '15',
    });
    const argv = buildSystemdRunArguments(service);

    assert.deepEqual(service.gottyLauncher.args, ['--nocolor', '/home/user/My Files']);
    assert.equal(argv[0], 'systemd-run');
    assert.ok(argv.includes('--user'));
    assert.ok(argv.includes('--service-type=exec'));
    assert.ok(argv.includes('--property=RuntimeMaxSec=900'));
    assert.ok(argv.includes('--permit-write'));
    assert.ok(argv.includes('/cb-gotty-mc-args'));

    const commandIndex = argv.indexOf('mc');
    assert.ok(commandIndex > 0);
    assert.deepEqual(argv.slice(commandIndex), ['mc', '--nocolor', '/home/user/My Files']);
    assert.equal(argv.includes('sh'), false);
    assert.equal(argv.includes('-c'), false);
});

test('supports btop and fish profiles with the same launcher model', () => {
    const btop = buildLauncherService({ ...BASE_DRAFT, id: 'btop-id', name: 'btop', command: 'btop' });
    const fish = buildLauncherService({ ...BASE_DRAFT, id: 'fish-id', name: 'Fish', command: 'fish' });
    assert.equal(btop.gottyLauncher.command, 'btop');
    assert.equal(fish.gottyLauncher.command, 'fish');
    assert.equal(btop.type, GOTTY_LAUNCHER_TYPE);
    assert.equal(fish.type, GOTTY_LAUNCHER_TYPE);
});

test('validates ports, runtime, and required commands', () => {
    assert.deepEqual(validateLauncherDraft(BASE_DRAFT), {});

    const errors = validateLauncherDraft({
        ...BASE_DRAFT,
        name: '',
        command: '',
        port: '80',
        address: 'bad address/path',
        autoStopMinutes: '0',
    });
    assert.ok(errors.name);
    assert.ok(errors.command);
    assert.ok(errors.port);
    assert.ok(errors.address);
    assert.ok(errors.autoStopMinutes);
});

test('argument editor uses one argv item per line', () => {
    const parsed = parseLauncherArguments('--foo\nvalue with spaces\n\n--bar');
    assert.deepEqual(parsed, ['--foo', 'value with spaces', '--bar']);
    assert.equal(formatLauncherArguments(parsed), '--foo\nvalue with spaces\n--bar');
});

test('expands the {host} placeholder in command, arguments, and listen address at start time', () => {
    const service = buildLauncherService({
        ...BASE_DRAFT,
        id: 'host-placeholder',
        command: '/usr/bin/ssh',
        args: '{host}\n--flag',
        address: '{host}',
    });

    assert.equal(service.gottyLauncher.address, '{host}');
    assert.deepEqual(service.gottyLauncher.args, ['{host}', '--flag']);

    const argv = buildSystemdRunArguments(service, '192.168.1.50');
    assert.equal(argv.includes('{host}'), false);

    const addressIndex = argv.indexOf('--address') + 1;
    assert.equal(argv[addressIndex], '192.168.1.50');

    const commandIndex = argv.indexOf('/usr/bin/ssh');
    assert.deepEqual(argv.slice(commandIndex), ['/usr/bin/ssh', '192.168.1.50', '--flag']);
});

test('expandLauncherHost substitutes {host} without URL-style IPv6 bracketing', () => {
    assert.equal(expandLauncherHost('{host}', '203.0.113.5'), '203.0.113.5');
    assert.equal(expandLauncherHost('prefix-{host}-suffix', 'example.local'), 'prefix-example.local-suffix');
    assert.equal(expandLauncherHost('{host}', '::1'), '::1');
    assert.equal(expandLauncherHost('no-placeholder', 'example.local'), 'no-placeholder');
});

test('distinguishes loopback-safe and network-facing listen addresses', () => {
    assert.equal(isNetworkExposedAddress('127.0.0.1'), false);
    assert.equal(isNetworkExposedAddress('127.0.0.2'), false);
    assert.equal(isNetworkExposedAddress('::1'), false);
    assert.equal(isNetworkExposedAddress('0.0.0.0'), true);
    assert.equal(isNetworkExposedAddress('::'), true);
    assert.equal(isNetworkExposedAddress('192.168.1.20'), true);
});
