import test from 'node:test';
import assert from 'node:assert/strict';

import {
    TERMINAL_PROVIDER_GOTTY,
    TERMINAL_PROVIDER_TTYD,
    buildLauncherService,
    buildSystemdRunArguments,
    defaultBinaryForProvider,
    launcherDraft,
    normalizeTerminalLauncher,
    terminalProviderLabel,
} from '../src/terminal-launcher.js';

const BASE = {
    id: 'provider-test',
    name: 'Shell',
    provider: TERMINAL_PROVIDER_GOTTY,
    binary: 'gotty',
    command: 'fish',
    args: '',
    port: '47200',
    address: '127.0.0.1',
    autoStopMinutes: '30',
    group: 'Terminal',
    icon: '⌨️',
    accent: 'teal',
};

test('legacy launcher data without provider stays GoTTY', () => {
    const normalized = normalizeTerminalLauncher({ binary: 'gotty', command: 'bash', port: 47200 });
    assert.equal(normalized.provider, TERMINAL_PROVIDER_GOTTY);
    assert.equal(normalized.binary, 'gotty');

    const draft = launcherDraft({
        id: 'legacy',
        name: 'Legacy',
        gottyLauncher: { binary: '/usr/local/bin/gotty', command: 'bash', port: 47201 },
    });
    assert.equal(draft.provider, TERMINAL_PROVIDER_GOTTY);
    assert.equal(draft.binary, '/usr/local/bin/gotty');
});

test('new launcher drafts listen on the Cockpit host while legacy fallback stays local', () => {
    const draft = launcherDraft(null, 47202);
    assert.equal(draft.address, '{host}');
    assert.equal(draft.port, '47202');

    const legacy = normalizeTerminalLauncher({ binary: 'gotty', command: 'bash', port: 47203 });
    assert.equal(legacy.address, '127.0.0.1');

    const service = buildLauncherService({ ...BASE, address: '{host}' });
    const argv = buildSystemdRunArguments(service, '192.168.1.20');
    const addressIndex = argv.indexOf('--address');
    assert.ok(addressIndex > 0);
    assert.equal(argv[addressIndex + 1], '192.168.1.20');
});

test('provider helpers expose GoTTY and ttyd defaults', () => {
    assert.equal(defaultBinaryForProvider(TERMINAL_PROVIDER_GOTTY), 'gotty');
    assert.equal(defaultBinaryForProvider(TERMINAL_PROVIDER_TTYD), 'ttyd');
    assert.equal(terminalProviderLabel(TERMINAL_PROVIDER_GOTTY), 'GoTTY');
    assert.equal(terminalProviderLabel(TERMINAL_PROVIDER_TTYD), 'ttyd');
});

test('builds a ttyd launcher while preserving the legacy bookmark schema', () => {
    const service = buildLauncherService({
        ...BASE,
        provider: TERMINAL_PROVIDER_TTYD,
        binary: 'ttyd',
    });

    assert.equal(service.type, 'gotty-launcher');
    assert.equal(service.integration, 'ttyd');
    assert.equal(service.gottyLauncher.provider, 'ttyd');
    assert.equal(service.gottyLauncher.binary, 'ttyd');
    assert.ok(service.tags.includes('ttyd'));
    assert.equal(service.tags.includes('gotty'), false);
    assert.match(service.description, /ttyd/);
});

test('uses provider-specific ttyd argv without GoTTY flags', () => {
    const service = buildLauncherService({
        ...BASE,
        provider: TERMINAL_PROVIDER_TTYD,
        binary: '/usr/bin/ttyd',
        args: '--login\nuser name',
        address: '0.0.0.0',
    });
    const argv = buildSystemdRunArguments(service);

    const ttydIndex = argv.indexOf('/usr/bin/ttyd');
    assert.ok(ttydIndex > 0);
    assert.deepEqual(argv.slice(ttydIndex), [
        '/usr/bin/ttyd',
        '--interface', '0.0.0.0',
        '--port', '47200',
        '--writable',
        '--base-path', '/cb-gotty-provider-test',
        'fish', '--login', 'user name',
    ]);
    assert.equal(argv.includes('--permit-write'), false);
    assert.equal(argv.includes('--address'), false);
    assert.equal(argv.includes('--path'), false);
});

test('GoTTY provider keeps the existing argv contract', () => {
    const service = buildLauncherService(BASE);
    const argv = buildSystemdRunArguments(service);
    assert.ok(argv.includes('--address'));
    assert.ok(argv.includes('--permit-write'));
    assert.ok(argv.includes('--path'));
    assert.equal(argv.includes('--writable'), false);
    assert.equal(argv.includes('--interface'), false);
});
