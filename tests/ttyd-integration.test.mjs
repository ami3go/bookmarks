import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDiscoveryCandidates } from '../src/discovery.js';
import {
    applyTtydDiscoveryCandidates,
    parseTtydCommandLine,
    ttydListenerPids,
} from '../src/ttyd-discovery.js';
import { TTYD_REDACTION_SCRIPT, inspectTtydListenersSafely } from '../src/ttyd-inspect.js';

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

test('parses ttyd TLS, writable, auth, and base path without credential values', () => {
    const parsed = parseTtydCommandLine([
        '/usr/bin/ttyd',
        '--ssl',
        '--writable',
        '--base-path', '/terminal',
        '--credential', 'alice:super-secret',
        'bash',
    ].join('\0'));

    assert.deepEqual(parsed, {
        inspected: true,
        tls: true,
        permitWrite: true,
        authentication: true,
        path: '/terminal/',
    });
    assert.equal(JSON.stringify(parsed).includes('super-secret'), false);
    assert.equal(JSON.stringify(parsed).includes('alice'), false);
});

test('turns ttyd listeners into terminal-specific discovery candidates', () => {
    const base = buildDiscoveryCandidates([LISTENER], [], 'mini-pc.local');
    const [candidate] = applyTtydDiscoveryCandidates(base, {
        7681: {
            inspected: true,
            tls: true,
            permitWrite: true,
            authentication: true,
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
    assert.ok(candidate.securityNotes.some(note => note.includes('Credential values')));
});

test('ttyd safe inspection redacts credentials before parsing', async () => {
    const calls = [];
    const cockpit = {
        spawn: async (argv, options) => {
            calls.push({ argv, options });
            return [
                '/usr/bin/ttyd',
                '-S',
                '-W',
                '-b', '/console',
                '-c', '<redacted>',
                'bash',
            ].join('\0');
        },
    };

    const result = await inspectTtydListenersSafely(cockpit, [LISTENER], SOCKET_OUTPUT);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].argv[0], 'bash');
    assert.equal(calls[0].argv[1], '-c');
    assert.equal(calls[0].argv[2], TTYD_REDACTION_SCRIPT);
    assert.equal(calls[0].argv[4], '444');
    assert.match(TTYD_REDACTION_SCRIPT, /<redacted>/);
    assert.equal(result[7681].tls, true);
    assert.equal(result[7681].permitWrite, true);
    assert.equal(result[7681].authentication, true);
    assert.equal(result[7681].path, '/console/');
});

test('ttyd inspection failure degrades to approximate discovery', async () => {
    const cockpit = { spawn: async () => { throw new Error('permission denied'); } };
    const info = await inspectTtydListenersSafely(cockpit, [LISTENER], SOCKET_OUTPUT);
    assert.equal(info[7681].inspected, false);

    const base = buildDiscoveryCandidates([LISTENER], [], 'mini-pc.local');
    const [candidate] = applyTtydDiscoveryCandidates(base, info);
    assert.equal(candidate.integration, 'ttyd');
    assert.equal(candidate.url, 'http://{host}:7681/');
    assert.ok(candidate.securityNotes.some(note => /approximate|safely/i.test(note)));
});
