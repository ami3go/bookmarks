import test from 'node:test';
import assert from 'node:assert/strict';

import { checkForPackageUpdate, parseAptPolicy } from '../src/update-check.js';

test('parses installed and candidate package versions', () => {
    const policy = parseAptPolicy(`cockpit-bookmarks:\n  Installed: 0.5.0-2\n  Candidate: 0.5.1-1\n  Version table:\n`);

    assert.deepEqual(policy, {
        installed: '0.5.0-2',
        candidate: '0.5.1-1',
    });
});

test('normalizes missing installed package to null', () => {
    const policy = parseAptPolicy(`cockpit-bookmarks:\n  Installed: (none)\n  Candidate: 0.5.1-1\n`);

    assert.deepEqual(policy, {
        installed: null,
        candidate: '0.5.1-1',
    });
});

test('normalizes unavailable candidate to null', () => {
    const policy = parseAptPolicy(`cockpit-bookmarks:\n  Installed: 0.5.0-2\n  Candidate: (none)\n`);

    assert.deepEqual(policy, {
        installed: '0.5.0-2',
        candidate: null,
    });
});

test('handles empty or unexpected apt-cache output safely', () => {
    assert.deepEqual(parseAptPolicy(''), { installed: null, candidate: null });
    assert.deepEqual(parseAptPolicy('N: Unable to locate package'), { installed: null, candidate: null });
});

test('reports a newer installable candidate', async () => {
    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            if (args[0] === 'apt-cache')
                return 'cockpit-bookmarks:\n  Installed: 0.5.0-2\n  Candidate: 0.5.1-1\n';
            if (args[0] === 'dpkg')
                return '';
            throw new Error('unexpected command');
        },
    };

    assert.deepEqual(await checkForPackageUpdate(cockpit), {
        installed: '0.5.0-2',
        candidate: '0.5.1-1',
    });
    assert.deepEqual(calls, [
        ['apt-cache', 'policy', 'cockpit-bookmarks'],
        ['dpkg', '--compare-versions', '0.5.1-1', 'gt', '0.5.0-2'],
    ]);
});

test('does not report the same candidate version', async () => {
    let compareCalled = false;
    const cockpit = {
        spawn: async args => {
            if (args[0] === 'apt-cache')
                return 'cockpit-bookmarks:\n  Installed: 0.5.0-2\n  Candidate: 0.5.0-2\n';
            compareCalled = true;
            return '';
        },
    };

    assert.equal(await checkForPackageUpdate(cockpit), null);
    assert.equal(compareCalled, false);
});

test('does not report a candidate that dpkg says is not newer', async () => {
    const cockpit = {
        spawn: async args => {
            if (args[0] === 'apt-cache')
                return 'cockpit-bookmarks:\n  Installed: 0.5.1-1\n  Candidate: 0.5.0-2\n';
            throw new Error('dpkg compare returned false');
        },
    };

    assert.equal(await checkForPackageUpdate(cockpit), null);
});

test('fails silently when package tools are unavailable', async () => {
    const cockpit = {
        spawn: async () => {
            throw new Error('not found');
        },
    };

    assert.equal(await checkForPackageUpdate(cockpit), null);
    assert.equal(await checkForPackageUpdate(null), null);
});
