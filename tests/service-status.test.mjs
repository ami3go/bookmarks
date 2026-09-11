import test from 'node:test';
import assert from 'node:assert/strict';

import {
    checkServiceStatus,
    checkServiceStatuses,
    socketTarget,
    summarizeServiceStatuses,
} from '../src/service-status.js';

test('extracts TCP targets from HTTP and HTTPS URLs', () => {
    assert.deepEqual(socketTarget('http://example.test/path'), { host: 'example.test', port: 80 });
    assert.deepEqual(socketTarget('https://example.test:9443/path'), { host: 'example.test', port: 9443 });
    assert.equal(socketTarget('ssh://example.test'), null);
});

test('marks a service online when any configured endpoint is reachable', async () => {
    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            const host = args.at(-2);
            if (host === 'primary.test')
                throw new Error('connection refused');
            return '';
        },
        message: error => error.message,
    };

    const result = await checkServiceStatus(cockpit, {
        enabled: true,
        endpoints: [
            { label: 'Primary', url: 'http://primary.test:3000' },
            { label: 'LAN', url: 'http://lan.test:3000' },
        ],
    });

    assert.equal(result.state, 'online');
    assert.equal(result.endpointLabel, 'LAN');
    assert.equal(calls.length, 2);
});

test('reports unknown when probe tools are unavailable', async () => {
    const cockpit = {
        spawn: async () => { throw new Error('spawn timeout: No such file or directory'); },
        message: error => error.message,
    };
    const result = await checkServiceStatus(cockpit, {
        enabled: true,
        endpoints: [{ label: 'Primary', url: 'http://example.test' }],
    });
    assert.equal(result.state, 'unknown');
});

test('checks multiple services with bounded workers and summarizes states', async () => {
    const cockpit = {
        spawn: async args => {
            const host = args.at(-2);
            if (host === 'offline.test')
                throw new Error('connection refused');
            return '';
        },
        message: error => error.message,
    };
    const entries = [
        { key: 'one', enabled: true, endpoints: [{ label: 'Primary', url: 'http://online.test' }] },
        { key: 'two', enabled: true, endpoints: [{ label: 'Primary', url: 'http://offline.test' }] },
        { key: 'three', enabled: false, endpoints: [{ label: 'Primary', url: 'http://disabled.test' }] },
    ];

    const statuses = await checkServiceStatuses(cockpit, entries, 2);
    assert.equal(statuses.one.state, 'online');
    assert.equal(statuses.two.state, 'offline');
    assert.equal(statuses.three.state, 'unknown');
    assert.deepEqual(summarizeServiceStatuses(entries, statuses), {
        total: 3,
        online: 1,
        offline: 1,
        unknown: 1,
    });
});
