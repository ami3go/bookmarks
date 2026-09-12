import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDiscoveryCandidates,
    gottyListenerPids,
    inspectGoTTYListeners,
    parseGoTTYCommandLine,
} from '../src/discovery.js';

const GOTTY_LISTENER = {
    port: 8080,
    addresses: ['0.0.0.0'],
    processes: ['gotty'],
    process: 'gotty',
    localOnly: false,
};

test('extracts only GoTTY listener PIDs from ss output', () => {
    const output = [
        'LISTEN 0 128 0.0.0.0:8080 0.0.0.0:* users:(("gotty",pid=321,fd=5))',
        'LISTEN 0 128 [::]:8080 [::]:* users:(("gotty",pid=321,fd=6))',
        'LISTEN 0 128 0.0.0.0:3000 0.0.0.0:* users:(("grafana-server",pid=100,fd=7))',
    ].join('\n');

    assert.deepEqual(gottyListenerPids(output), { 8080: [321] });
});

test('parses GoTTY security and URL flags without retaining credentials', () => {
    const commandLine = [
        '/usr/local/bin/gotty',
        '--path', '/terminal',
        '--tls',
        '--permit-write',
        '--credential', 'alice:super-secret-password',
        'bash',
    ].join('\0');

    const parsed = parseGoTTYCommandLine(commandLine);
    assert.deepEqual(parsed, {
        inspected: true,
        tls: true,
        permitWrite: true,
        authentication: true,
        randomUrl: false,
        path: '/terminal/',
    });
    assert.equal(JSON.stringify(parsed).includes('super-secret-password'), false);
    assert.equal(JSON.stringify(parsed).includes('alice'), false);
});

test('recognizes GoTTY and builds terminal-specific safe defaults', () => {
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
    assert.ok(candidate.bookmark.tags.includes('terminal'));
    assert.ok(candidate.securityNotes.some(note => note.includes('Interactive input is enabled')));
    assert.ok(candidate.securityNotes.some(note => note.includes('Credentials are intentionally not read or stored')));
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

test('falls back safely when GoTTY command-line details are unavailable', () => {
    const [candidate] = buildDiscoveryCandidates([GOTTY_LISTENER], [], 'mini-pc.local');

    assert.equal(candidate.integration, 'gotty');
    assert.equal(candidate.url, 'http://{host}:8080/');
    assert.equal(candidate.supported, true);
    assert.equal(candidate.selected, true);
    assert.equal(candidate.gotty.inspected, false);
    assert.ok(candidate.securityNotes.some(note => note.includes('could not be inspected') || note.includes('approximate')));
});

test('inspects /proc command line for detected GoTTY without exposing raw arguments', async () => {
    const output = 'LISTEN 0 128 0.0.0.0:8080 0.0.0.0:* users:(("gotty",pid=321,fd=5))';
    const calls = [];
    const cockpit = {
        spawn: async (argv, options) => {
            calls.push({ argv, options });
            return ['/usr/bin/gotty', '-t', '-m', '/console', '-c', 'user:password', 'bash'].join('\0');
        },
    };

    const result = await inspectGoTTYListeners(cockpit, [GOTTY_LISTENER], output);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].argv, ['cat', '/proc/321/cmdline']);
    assert.equal(result[8080].tls, true);
    assert.equal(result[8080].path, '/console/');
    assert.equal(result[8080].authentication, true);
    assert.equal(JSON.stringify(result).includes('password'), false);
});

test('process inspection permission failures degrade to approximate GoTTY discovery', async () => {
    const output = 'LISTEN 0 128 0.0.0.0:8080 0.0.0.0:* users:(("gotty",pid=321,fd=5))';
    const cockpit = {
        spawn: async () => {
            throw new Error('permission denied');
        },
    };

    const result = await inspectGoTTYListeners(cockpit, [GOTTY_LISTENER], output);
    assert.equal(result[8080].inspected, false);
    assert.match(result[8080].reason, /could not be inspected/i);
});
