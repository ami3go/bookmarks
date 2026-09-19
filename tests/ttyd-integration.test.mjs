import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDiscoveryCandidates } from '../src/discovery.js';
import {
    applyTtydDiscoveryCandidates,
    ttydListenerPids,
} from '../src/ttyd-discovery.js';
import { inspectTerminalListenersSafely } from '../src/terminal-inspect.js';

const LISTENER = {
    port: 7681,
    addresses: ['0.0.0.0'],
    processes: ['ttyd'],
    process: 'ttyd',
    localOnly: false,
};

const SOCKET_OUTPUT = 'LISTEN 0 128 0.0.0.0:7681 0.0.0.0:* users:(("ttyd",pid=444,fd=5))';

test('extracts ttyd listener PIDs from ss output', () => {
    assert.deepEqual(ttydListenerPids(SOCKET_OUTPUT), { 7681: [444] });
});

test('turns ttyd host facts into terminal-specific discovery candidates', () => {
    const base = buildDiscoveryCandidates([LISTENER], [], 'mini-pc.local');
    const [candidate] = applyTtydDiscoveryCandidates(base, {
        7681: {
            inspected: true,
            tls: true,
            permitWrite: true,
            authentication: true,
            readonly: false,
            unknownOptions: false,
            path: '/terminal/',
        },
    });

    assert.equal(candidate.integration, 'ttyd');
    assert.equal(candidate.name, 'ttyd Terminal');
    assert.equal(candidate.url, 'https://{host}:7681/terminal/');
    assert.equal(candidate.supported, true);
    assert.equal(candidate.selected, true);
    assert.equal(candidate.bookmark.integration, 'ttyd');
    assert.ok(candidate.bookmark.tags.includes('ttyd'));
    assert.ok(candidate.securityNotes.some(note => note.includes('--writable')));
    assert.ok(candidate.securityNotes.some(note => note.includes('Credential values never leave')));
});

test('browser receives only facts from host-side ttyd inspection', async () => {
    const calls = [];
    const cockpit = {
        spawn: async (argv, options) => {
            calls.push({ argv, options });
            return 'inspected=1\ntls=1\npermitWrite=1\nauthentication=1\nrandomUrl=0\nreadonly=0\nunknown=0\npath=/console/\n';
        },
    };

    const result = await inspectTerminalListenersSafely(cockpit, 'ttyd', [LISTENER], SOCKET_OUTPUT);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].argv[0], 'bash');
    assert.equal(calls[0].argv[4], 'ttyd');
    assert.equal(calls[0].argv[5], '444');
    assert.equal(result[7681].tls, true);
    assert.equal(result[7681].permitWrite, true);
    assert.equal(result[7681].authentication, true);
    assert.equal(result[7681].path, '/console/');
    assert.equal(JSON.stringify(result).includes('password'), false);
});

test('ttyd inspection failure degrades to approximate discovery', async () => {
    const cockpit = { spawn: async () => { throw new Error('permission denied'); } };
    const info = await inspectTerminalListenersSafely(cockpit, 'ttyd', [LISTENER], SOCKET_OUTPUT);
    assert.equal(info[7681].inspected, false);

    const base = buildDiscoveryCandidates([LISTENER], [], 'mini-pc.local');
    const [candidate] = applyTtydDiscoveryCandidates(base, info);
    assert.equal(candidate.integration, 'ttyd');
    assert.equal(candidate.url, 'http://{host}:7681/');
    assert.ok(candidate.securityNotes.some(note => /approximate|safely/i.test(note)));
});

test('ttyd read-only and unknown option facts are reported conservatively', () => {
    const base = buildDiscoveryCandidates([LISTENER], [], 'mini-pc.local');
    const [candidate] = applyTtydDiscoveryCandidates(base, {
        7681: {
            inspected: true,
            tls: false,
            permitWrite: false,
            authentication: false,
            readonly: true,
            unknownOptions: true,
            path: '/',
        },
    });
    assert.ok(candidate.securityNotes.some(note => note.includes('explicitly read-only')));
    assert.ok(candidate.securityNotes.some(note => note.includes('Unrecognized ttyd options')));
});
