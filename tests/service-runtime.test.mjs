import assert from 'node:assert/strict';
import test from 'node:test';

import {
    launcherStates,
    openService,
    parseLauncherStates,
} from '../src/service-runtime.js';

function pendingTab() {
    const body = {
        style: {},
        children: [],
        replaceChildren() { this.children = []; },
        append(...nodes) { this.children.push(...nodes); },
    };
    const document = {
        title: '',
        body,
        createElement(tag) {
            return { tag, textContent: '' };
        },
    };
    const navigations = [];
    return {
        tab: {
            closed: false,
            opener: {},
            document,
            location: { replace: value => navigations.push(value) },
        },
        navigations,
    };
}

test('application launcher opens a pending tab synchronously before startup resolves', async () => {
    const { tab, navigations } = pendingTab();
    const opens = [];
    let resolveStart;
    const startPromise = new Promise(resolve => { resolveStart = resolve; });
    const service = {
        id: 'app-one',
        type: 'application-launcher',
        name: 'App One',
        url: 'http://{host}:47300/cb-app-app-one/',
    };

    const operation = openService(service, {
        cockpit: {},
        hostname: 'mini-pc.local',
        openWindow: (...args) => {
            opens.push(args);
            return tab;
        },
        startApplication: () => startPromise,
    });

    assert.deepEqual(opens, [['about:blank', '_blank']]);
    assert.equal(tab.opener, null);
    assert.equal(tab.document.title, 'Starting application…');
    assert.deepEqual(navigations, []);

    resolveStart({ url: 'http://mini-pc.local:47300/session' });
    await operation;
    assert.deepEqual(navigations, ['http://mini-pc.local:47300/session']);
});

test('launcher startup failures stay in the pending tab with a useful error', async () => {
    const { tab, navigations } = pendingTab();
    const service = {
        id: 'terminal-one',
        type: 'gotty-launcher',
        name: 'Terminal One',
        url: 'http://{host}:47200/cb-gotty-terminal-one/',
    };

    await openService(service, {
        cockpit: { message: error => error.message },
        hostname: 'mini-pc.local',
        openWindow: () => tab,
        startTerminal: async () => { throw new Error('provider missing'); },
    });

    assert.equal(tab.document.title, 'Could not start terminal');
    assert.equal(tab.document.body.children.at(-1).textContent, 'provider missing');
    assert.deepEqual(navigations, []);
});

test('launcher state parsing and lookup use one batched systemctl query', async () => {
    const output = [
        'Id=cockpit-bookmarks-gotty-term.service',
        'ActiveState=active',
        '',
        'Id=cockpit-bookmarks-app-web.service',
        'ActiveState=failed',
        '',
    ].join('\n');
    assert.deepEqual(
        [...parseLauncherStates(output)],
        [
            ['cockpit-bookmarks-gotty-term.service', 'running'],
            ['cockpit-bookmarks-app-web.service', 'failed'],
        ]
    );

    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            return output;
        },
    };
    const services = [
        { id: 'term', type: 'gotty-launcher' },
        { id: 'web', type: 'application-launcher' },
        { id: 'plain', url: 'http://example.test' },
    ];
    const states = await launcherStates(services, cockpit);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [
        'systemctl', '--user', 'show', '--property=Id', '--property=ActiveState', '--',
        'cockpit-bookmarks-gotty-term.service',
        'cockpit-bookmarks-app-web.service',
    ]);
    assert.equal(states.get('term'), 'running');
    assert.equal(states.get('web'), 'failed');
    assert.equal(states.has('plain'), false);
});
