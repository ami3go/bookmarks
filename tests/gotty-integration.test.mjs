import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDiscoveryCandidates,
    gottyListenerPids,
} from '../src/discovery.js';
import { inspectTerminalListenersSafely } from '../src/terminal-inspect.js';

const GOTTY_LISTENER = {
    port: 8080,
    addresses: ['0.0.0.0'],
    processes: ['gotty'],
    process: 'gotty',
    localOnly: false,
};

const SOCKET_OUTPUT = 'LISTEN 0 128 0.0.0.0:8080 0.0.0.0:* users:(("gotty",pid=321,fd=5))';

test('extracts only GoTTY listener PIDs from ss output', () => {
    const output = [
        SOCKET_OUTPUT,
        'LISTEN 0 128 [::]:8080 [::]:* users:(("gotty",pid=321,fd=6))',
        'LISTEN 0 128 0.0.0.0:3000 0.0.0.0:* users:(("grafana-server",pid=100,fd=7))',
    ].join('\n');

    assert.deepEqual(gottyListenerPids(output), { 8080: [321] });
});

test('recognizes GoTTY and builds terminal-specific safe defaults from facts', () => {
    const [candidate] = buildDiscoveryCandidates(
        [GOTTY_LISTENER],
        [],
        'mini-pc.local',
        {
            8080: {
                inspected: true,
                tls: true,
                permitWrite: true,
                authentication: true,
                randomUrl: false,
                unknownOptions: false,
                path: '/terminal/',
            },
        }
    );

    assert.equal(candidate.integration, 'gotty');
    assert.equal(candidate.name, 'GoTTY Terminal');
    assert.equal(candidate.url, 'https://{host}:8080/terminal/');
    assert.equal(candidate.supported, true);
    assert.equal(candidate.selected, true);
    assert.equal(candidate.bookmark.group, 'Terminal');
    assert.equal(candidate.bookmark.icon, '⌨️');
    assert.equal(candidate.bookmark.accent, 'teal');
    assert.equal(candidate.bookmark.integration, 'gotty');
    assert.equal(candidate.bookmark.statusCheck, true);
    assert.ok(candidate.bookmark.tags.includes('GoTTY'));
    assert.ok(candidate.securityNotes.some(note => note.includes('Interactive input is enabled')));
    assert.ok(candidate.securityNotes.some(note => note.includes('Credential values never leave')));
});

test('does not auto-add GoTTY random URL mode', () => {
    const [candidate] = buildDiscoveryCandidates(
        [GOTTY_LISTENER],
        [],
        'mini-pc.local',
        {
            8080: {
                inspected: true,
                tls: false,
                permitWrite: false,
                authentication: false,
                randomUrl: true,
                path: '/',
            },
        }
    );

    assert.equal(candidate.supported, false);
    assert.equal(candidate.selected, false);
    assert.equal(candidate.reason, 'GoTTY random URL requires a manual bookmark');
    assert.ok(candidate.securityNotes.some(note => note.includes('generated final URL manually')));
});

test('falls back safely when GoTTY process details are unavailable', () => {
    const [candidate] = buildDiscoveryCandidates([GOTTY_LISTENER], [], 'mini-pc.local');

    assert.equal(candidate.integration, 'gotty');
    assert.equal(candidate.url, 'http://{host}:8080/');
    assert.equal(candidate.supported, true);
    assert.equal(candidate.selected, true);
    assert.equal(candidate.gotty.inspected, false);
    assert.ok(candidate.securityNotes.some(note => note.includes('could not be inspected') || note.includes('approximate')));
});

test('browser receives only terminal facts from host-side GoTTY inspection', async () => {
    const calls = [];
    const cockpit = {
        spawn: async (argv, options) => {
            calls.push({ argv, options });
            return 'inspected=1\ntls=1\npermitWrite=1\nauthentication=1\nrandomUrl=0\nreadonly=0\nunknown=0\npath=/console/\n';
        },
    };

    const result = await inspectTerminalListenersSafely(cockpit, 'gotty', [GOTTY_LISTENER], SOCKET_OUTPUT);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].argv[0], 'bash');
    assert.equal(calls[0].argv[4], 'gotty');
    assert.equal(calls[0].argv[5], '321');
    assert.deepEqual(result[8080], {
        inspected: true,
        tls: true,
        permitWrite: true,
        authentication: true,
        randomUrl: false,
        readonly: false,
        unknownOptions: false,
        path: '/console/',
    });
    assert.equal(JSON.stringify(result).includes('password'), false);
});

test('process inspection permission failures degrade to approximate GoTTY discovery', async () => {
    const cockpit = { spawn: async () => { throw new Error('permission denied'); } };
    const result = await inspectTerminalListenersSafely(cockpit, 'gotty', [GOTTY_LISTENER], SOCKET_OUTPUT);
    assert.equal(result[8080].inspected, false);
    assert.match(result[8080].reason, /could not be inspected safely/i);
});
