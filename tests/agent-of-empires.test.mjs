import assert from 'node:assert/strict';
import test from 'node:test';

import {
    agentOfEmpiresRunning,
    isAgentOfEmpiresService,
    rewriteAgentOfEmpiresUrl,
    startAgentOfEmpires,
    stopAgentOfEmpires,
} from '../src/agent-of-empires.js';
import { launcherStates, openService } from '../src/service-runtime.js';

function aoeService(overrides = {}) {
    return {
        id: 'aoe-test',
        type: 'application-launcher',
        name: 'Agent of Empires',
        applicationLauncher: {
            command: '/usr/local/bin/aoe',
            args: ['serve', '--host', '0.0.0.0', '--daemon'],
            bindHost: '0.0.0.0',
            port: 8080,
            startupTimeoutSeconds: 3,
            urlCommand: '/usr/local/bin/aoe',
            urlArgs: ['url'],
            ...overrides,
        },
    };
}

function pendingTab() {
    const body = {
        style: {},
        children: [],
        replaceChildren() { this.children = []; },
        append(...nodes) { this.children.push(...nodes); },
    };
    const navigations = [];
    return {
        tab: {
            closed: false,
            opener: {},
            document: {
                title: '',
                body,
                createElement(tag) { return { tag, textContent: '' }; },
            },
            location: { replace: value => navigations.push(value) },
        },
        navigations,
    };
}

test('recognizes existing Agent of Empires launcher bookmarks', () => {
    assert.equal(isAgentOfEmpiresService(aoeService()), true);
    assert.equal(isAgentOfEmpiresService({
        type: 'application-launcher',
        applicationLauncher: { command: 'aoe', args: ['serve'], urlCommand: 'aoe', urlArgs: ['url'] },
    }), true);
    assert.equal(isAgentOfEmpiresService({
        type: 'application-launcher',
        applicationLauncher: { command: 'other', args: ['serve'], urlCommand: 'other', urlArgs: ['url'] },
    }), false);
});

test('rewrites aoe url host while preserving token, path, port, and query', () => {
    assert.equal(
        rewriteAgentOfEmpiresUrl('http://127.0.0.1:8080/dashboard?token=abc123&view=home', 'mini-pc.local'),
        'http://mini-pc.local:8080/dashboard?token=abc123&view=home'
    );
});

test('clicking a running AoE bookmark only fetches aoe url and opens its token URL', async () => {
    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            if (args[1] === 'url')
                return 'http://127.0.0.1:8080/?token=running-token\n';
            throw new Error(`Unexpected command: ${args.join(' ')}`);
        },
    };
    const { tab, navigations } = pendingTab();

    await openService(aoeService(), {
        cockpit,
        hostname: 'mini-pc.local',
        openWindow: () => tab,
    });

    assert.deepEqual(calls, [['/usr/local/bin/aoe', 'url']]);
    assert.deepEqual(navigations, ['http://mini-pc.local:8080/?token=running-token']);
});

test('stopped AoE starts as a daemon, then opens the token URL returned by aoe url', async () => {
    const calls = [];
    let urlCalls = 0;
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            if (args[1] === 'url') {
                urlCalls += 1;
                if (urlCalls === 1)
                    throw new Error('not running');
                return 'http://localhost:8080/?token=new-token\n';
            }
            if (args[1] === 'serve' && args.includes('--daemon'))
                return '';
            throw new Error(`Unexpected command: ${args.join(' ')}`);
        },
    };

    const result = await startAgentOfEmpires(cockpit, aoeService(), '192.168.1.20');
    assert.equal(result.reused, false);
    assert.equal(result.url, 'http://192.168.1.20:8080/?token=new-token');
    assert.deepEqual(calls[1], ['/usr/local/bin/aoe', 'serve', '--host', '0.0.0.0', '--daemon']);
});

test('AoE adds allowed-host when Cockpit is reached by hostname', async () => {
    const calls = [];
    let urlCalls = 0;
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            if (args[1] === 'url') {
                urlCalls += 1;
                if (urlCalls === 1)
                    throw new Error('not running');
                return 'http://127.0.0.1:8080/?token=name-token\n';
            }
            if (args[1] === 'serve')
                return '';
            throw new Error(`Unexpected command: ${args.join(' ')}`);
        },
    };

    await startAgentOfEmpires(cockpit, aoeService(), 'mini-pc.local');
    assert.deepEqual(calls[1], [
        '/usr/local/bin/aoe', 'serve', '--host', '0.0.0.0', '--daemon', '--allowed-host', 'mini-pc.local',
    ]);
});

test('AoE running state and stop use the native daemon commands', async () => {
    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            if (args[1] === 'serve' && args[2] === '--status')
                return 'running';
            if (args[1] === 'serve' && args[2] === '--stop')
                return '';
            throw new Error(`Unexpected command: ${args.join(' ')}`);
        },
    };
    const service = aoeService();

    assert.equal(await agentOfEmpiresRunning(cockpit, service), true);
    const states = await launcherStates([service], cockpit);
    assert.equal(states.get(service.id), 'running');
    await stopAgentOfEmpires(cockpit, service);

    assert.ok(calls.some(args => args[1] === 'serve' && args[2] === '--status'));
    assert.ok(calls.some(args => args[1] === 'serve' && args[2] === '--stop'));
    assert.equal(calls.some(args => args[0] === 'systemctl'), false);
});
