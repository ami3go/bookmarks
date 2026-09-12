import test from 'node:test';
import assert from 'node:assert/strict';

import {
    GOTTY_LAUNCHER_PORT_END,
    GOTTY_LAUNCHER_PORT_START,
    parseListeningTcpPorts,
    suggestGoTTYLauncherPort,
} from '../src/gotty-launcher-ports.js';

test('uses the dedicated 47200-47299 automatic launcher range', () => {
    assert.equal(GOTTY_LAUNCHER_PORT_START, 47200);
    assert.equal(GOTTY_LAUNCHER_PORT_END, 47299);
    assert.equal(suggestGoTTYLauncherPort([]), 47200);
});

test('skips ports already assigned to launcher bookmarks', () => {
    const launchers = [
        { gottyLauncher: { port: 47200 } },
        { gottyLauncher: { port: 47201 } },
    ];
    assert.equal(suggestGoTTYLauncherPort(launchers), 47202);
});

test('skips ports already listening on the host', () => {
    const output = [
        'LISTEN 0 128 127.0.0.1:47200 0.0.0.0:*',
        'LISTEN 0 128 [::]:47201 [::]:*',
        'LISTEN 0 128 0.0.0.0:8080 0.0.0.0:*',
    ].join('\n');
    const listening = parseListeningTcpPorts(output);
    assert.deepEqual([...listening].sort((a, b) => a - b), [8080, 47200, 47201]);
    assert.equal(suggestGoTTYLauncherPort([], listening), 47202);
});

test('returns null when the dedicated automatic pool is exhausted', () => {
    const listening = [];
    for (let port = GOTTY_LAUNCHER_PORT_START; port <= GOTTY_LAUNCHER_PORT_END; port += 1)
        listening.push(port);
    assert.equal(suggestGoTTYLauncherPort([], listening), null);
});
