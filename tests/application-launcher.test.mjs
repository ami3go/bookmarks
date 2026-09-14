import test from 'node:test';
import assert from 'node:assert/strict';

import {
    APPLICATION_LAUNCHER_TYPE,
    agentOfEmpiresDraft,
    applicationIdFromUrl,
    applicationPath,
    applicationUnitName,
    applicationUrl,
    buildApplicationService,
    buildApplicationSystemdRunArguments,
    extractApplicationUrl,
    parseApplicationArguments,
    rewriteApplicationUrl,
    validateApplicationDraft,
} from '../src/application-launcher.js';
import {
    AGENT_OF_EMPIRES_DEFAULT_PORT,
    APPLICATION_LAUNCHER_PORT_START,
    suggestAgentOfEmpiresPort,
    suggestApplicationLauncherPort,
} from '../src/application-launcher-ports.js';

const BASE = {
    id: 'app-test',
    name: 'Web App',
    command: '/usr/bin/example',
    args: '--host\n{bind}\n--port\n{port}',
    bindHost: '0.0.0.0',
    port: '47300',
    autoStopMinutes: '60',
    startupTimeoutSeconds: '20',
    urlCommand: '',
    urlArgs: '',
    urlPattern: 'https?://[^\\s]+',
    icon: '🚀',
    accent: 'orange',
};

test('builds deterministic application launcher identity', () => {
    assert.equal(applicationPath('abc-123'), '/cb-app-abc-123/');
    assert.equal(applicationUrl('abc-123', 47300), 'http://{host}:47300/cb-app-abc-123/');
    assert.equal(applicationIdFromUrl('http://mini.local:47300/cb-app-abc-123/'), 'abc-123');
    assert.equal(applicationUnitName('abc-123'), 'cockpit-bookmarks-app-abc-123.service');
});

test('builds Agent of Empires preset without persisting an auth token', () => {
    const draft = { ...agentOfEmpiresDraft(47300), id: 'aoe-test' };
    const service = buildApplicationService(draft);
    assert.equal(service.type, APPLICATION_LAUNCHER_TYPE);
    assert.equal(service.group, 'Applications');
    assert.equal(service.applicationLauncher.command, 'aoe');
    assert.deepEqual(service.applicationLauncher.args.slice(0, 5), ['serve', '--host', '{bind}', '--port', '{port}']);
    assert.equal(service.applicationLauncher.bindHost, '0.0.0.0');
    assert.equal(service.applicationLauncher.urlCommand, 'aoe');
    assert.deepEqual(service.applicationLauncher.urlArgs, ['url']);
    assert.equal(service.url.includes('token='), false);
    assert.equal(JSON.stringify(service).includes('token='), false);

    const argv = buildApplicationSystemdRunArguments(service, 'mini-pc.local');
    const commandIndex = argv.indexOf('aoe');
    assert.ok(commandIndex > 0);
    assert.deepEqual(argv.slice(commandIndex), [
        'aoe', 'serve', '--host', '0.0.0.0', '--port', '47300', '--allowed-host', 'mini-pc.local',
    ]);
});

test('passes web application arguments directly without a shell', () => {
    const service = buildApplicationService(BASE);
    const argv = buildApplicationSystemdRunArguments(service, 'mini-pc.local');
    assert.equal(argv[0], 'systemd-run');
    assert.ok(argv.includes('--user'));
    assert.ok(argv.includes('--property=RuntimeMaxSec=3600'));
    const commandIndex = argv.indexOf('/usr/bin/example');
    assert.ok(commandIndex > 0);
    assert.deepEqual(argv.slice(commandIndex), ['/usr/bin/example', '--host', '0.0.0.0', '--port', '47300']);
    assert.equal(argv.includes('sh'), false);
    assert.equal(argv.includes('-c'), false);
});

test('extracts printed URLs and rewrites only local hostname', () => {
    const output = 'aoe web dashboard running at:\n  http://localhost:8080/?token=a1b2c3\n';
    const captured = extractApplicationUrl(output);
    assert.equal(captured, 'http://localhost:8080/?token=a1b2c3');
    assert.equal(rewriteApplicationUrl(captured, '192.168.1.20'), 'http://192.168.1.20:8080/?token=a1b2c3');
    assert.equal(
        rewriteApplicationUrl('https://public.example.test/session?token=xyz', '192.168.1.20'),
        'https://public.example.test/session?token=xyz'
    );
});

test('uses first capture group when URL pattern contains one', () => {
    const output = 'READY url=[http://127.0.0.1:47300/path?q=1]';
    assert.equal(extractApplicationUrl(output, 'url=\\[(https?://[^\\]]+)\\]'), 'http://127.0.0.1:47300/path?q=1');
});

test('validates web launcher parameters', () => {
    assert.deepEqual(validateApplicationDraft(BASE), {});
    const errors = validateApplicationDraft({
        ...BASE,
        name: '',
        command: '',
        bindHost: 'bad host/path',
        port: '80',
        autoStopMinutes: '0',
        startupTimeoutSeconds: '1',
        urlPattern: '(',
    });
    assert.ok(errors.name);
    assert.ok(errors.command);
    assert.ok(errors.bindHost);
    assert.ok(errors.port);
    assert.ok(errors.autoStopMinutes);
    assert.ok(errors.startupTimeoutSeconds);
    assert.ok(errors.urlPattern);
});

test('parses argv one item per line', () => {
    assert.deepEqual(parseApplicationArguments('serve\n--host\n0.0.0.0\nvalue with spaces'), ['serve', '--host', '0.0.0.0', 'value with spaces']);
});

test('allocates web application ports without colliding with saved launchers or listeners', () => {
    const services = [
        { gottyLauncher: { port: APPLICATION_LAUNCHER_PORT_START } },
        { applicationLauncher: { port: APPLICATION_LAUNCHER_PORT_START + 1 } },
    ];
    assert.equal(
        suggestApplicationLauncherPort(services, [APPLICATION_LAUNCHER_PORT_START + 2]),
        APPLICATION_LAUNCHER_PORT_START + 3
    );
});

test('Agent of Empires prefers port 8080 and falls back to managed application ports', () => {
    assert.equal(suggestAgentOfEmpiresPort([], []), AGENT_OF_EMPIRES_DEFAULT_PORT);
    assert.equal(
        suggestAgentOfEmpiresPort([], [AGENT_OF_EMPIRES_DEFAULT_PORT]),
        APPLICATION_LAUNCHER_PORT_START
    );
    assert.equal(
        suggestAgentOfEmpiresPort([{ applicationLauncher: { port: AGENT_OF_EMPIRES_DEFAULT_PORT } }], []),
        APPLICATION_LAUNCHER_PORT_START
    );
});
