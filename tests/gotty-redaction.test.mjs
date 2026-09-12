import test from 'node:test';
import assert from 'node:assert/strict';

import {
    GOTTY_REDACTION_SCRIPT,
    inspectGoTTYListenersSafely,
} from '../src/gotty-inspect.js';

const LISTENER = {
    port: 8080,
    addresses: ['0.0.0.0'],
    processes: ['gotty'],
    process: 'gotty',
    localOnly: false,
};

const SOCKET_OUTPUT = 'LISTEN 0 128 0.0.0.0:8080 0.0.0.0:* users:(("gotty",pid=321,fd=5))';

test('GoTTY inspection redacts credentials on the host before parsing', async () => {
    const calls = [];
    const cockpit = {
        spawn: async (argv, options) => {
            calls.push({ argv, options });
            return [
                '/usr/bin/gotty',
                '--tls',
                '--path', '/terminal',
                '--credential', '<redacted>',
                '--permit-write',
                'bash',
            ].join('\0');
        },
    };

    const result = await inspectGoTTYListenersSafely(cockpit, [LISTENER], SOCKET_OUTPUT);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].argv[0], 'bash');
    assert.equal(calls[0].argv[1], '-c');
    assert.equal(calls[0].argv[2], GOTTY_REDACTION_SCRIPT);
    assert.equal(calls[0].argv[4], '321');
    assert.match(GOTTY_REDACTION_SCRIPT, /<redacted>/);
    assert.match(GOTTY_REDACTION_SCRIPT, /\/proc\/\$pid\/cmdline/);
    assert.deepEqual(result[8080], {
        inspected: true,
        tls: true,
        permitWrite: true,
        authentication: true,
        randomUrl: false,
        path: '/terminal/',
    });
    assert.equal(JSON.stringify(result).includes('password'), false);
});

test('safe GoTTY inspection degrades to approximate discovery on failure', async () => {
    const cockpit = {
        spawn: async () => {
            throw new Error('permission denied');
        },
    };

    const result = await inspectGoTTYListenersSafely(cockpit, [LISTENER], SOCKET_OUTPUT);
    assert.equal(result[8080].inspected, false);
    assert.match(result[8080].reason, /could not be inspected safely/i);
});
