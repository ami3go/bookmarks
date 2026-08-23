import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDiscoveryCandidates,
    existingLocalBookmarkPorts,
    parseListeningSockets,
} from '../src/discovery.js';

test('parses and deduplicates ss listening sockets', () => {
    const output = [
        'LISTEN 0 4096 0.0.0.0:3000 0.0.0.0:* users:(("grafana-server",pid=123,fd=10))',
        'LISTEN 0 4096 [::]:3000 [::]:* users:(("grafana-server",pid=123,fd=11))',
        'LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("node",pid=456,fd=20))',
        'ESTAB 0 0 10.0.0.2:22 10.0.0.3:50000 users:(("sshd",pid=1,fd=3))',
    ].join('\n');

    assert.deepEqual(parseListeningSockets(output), [
        {
            port: 3000,
            addresses: ['0.0.0.0', '::'],
            processes: ['grafana-server'],
            process: 'grafana-server',
            localOnly: false,
        },
        {
            port: 8080,
            addresses: ['127.0.0.1'],
            processes: ['node'],
            process: 'node',
            localOnly: true,
        },
    ]);
});

test('detects existing local bookmark ports without matching external services', () => {
    const ports = existingLocalBookmarkPorts([
        { url: 'http://{host}:3000' },
        { url: 'https://mini-pc.local:8443/path' },
        { url: 'https://example.com:9443' },
    ], 'mini-pc.local');

    assert.deepEqual([...ports].sort((a, b) => a - b), [3000, 8443]);
});

test('builds safe discovery defaults and excludes known non-web listeners', () => {
    const candidates = buildDiscoveryCandidates([
        { port: 22, addresses: ['0.0.0.0'], processes: ['sshd'], process: 'sshd', localOnly: false },
        { port: 3000, addresses: ['0.0.0.0'], processes: ['grafana-server'], process: 'grafana-server', localOnly: false },
        { port: 8443, addresses: ['0.0.0.0'], processes: [], process: '', localOnly: false },
        { port: 8080, addresses: ['127.0.0.1'], processes: ['node'], process: 'node', localOnly: true },
        { port: 9090, addresses: ['0.0.0.0'], processes: ['cockpit-ws'], process: 'cockpit-ws', localOnly: false },
    ], [], 'mini-pc.local');

    assert.equal(candidates[0].supported, false);
    assert.equal(candidates[0].selected, false);

    assert.equal(candidates[1].name, 'Grafana');
    assert.equal(candidates[1].url, 'http://{host}:3000');
    assert.equal(candidates[1].selected, true);
    assert.deepEqual(candidates[1].bookmark.tags, ['discovered', 'port-3000', 'grafana-server']);

    assert.equal(candidates[2].scheme, 'https');
    assert.equal(candidates[2].selected, true);

    assert.equal(candidates[3].localOnly, true);
    assert.equal(candidates[3].selected, false);

    assert.equal(candidates[4].supported, false);
    assert.equal(candidates[4].reason, 'Cockpit itself');
});

test('marks already-bookmarked ports and leaves unknown protocols unselected', () => {
    const candidates = buildDiscoveryCandidates([
        { port: 3000, addresses: ['0.0.0.0'], processes: ['grafana-server'], process: 'grafana-server', localOnly: false },
        { port: 12345, addresses: ['0.0.0.0'], processes: [], process: '', localOnly: false },
    ], [{ url: 'http://{host}:3000' }], 'mini-pc.local');

    assert.equal(candidates[0].alreadyBookmarked, true);
    assert.equal(candidates[0].selected, false);
    assert.equal(candidates[1].supported, true);
    assert.equal(candidates[1].likelyWeb, false);
    assert.equal(candidates[1].selected, false);
});
