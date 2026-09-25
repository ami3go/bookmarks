import test from 'node:test';
import assert from 'node:assert/strict';

import { aptPolicyHasRepository, checkForPackageUpdate, parseAptPolicy } from '../src/update-check.js';

const REPOSITORY_POLICY = `cockpit-bookmarks:\n  Installed: 0.5.0-2\n  Candidate: 0.5.1-1\n  Version table:\n     0.5.1-1 500\n        500 https://packages.example.test stable/main all Packages\n *** 0.5.0-2 100\n        100 /var/lib/dpkg/status\n`;

test('parses installed/candidate versions and recognizes an APT repository source', () => {
    assert.deepEqual(parseAptPolicy(REPOSITORY_POLICY), {
        installed: '0.5.0-2',
        candidate: '0.5.1-1',
        repositoryAvailable: true,
    });
    assert.equal(aptPolicyHasRepository(REPOSITORY_POLICY), true);
});

test('standalone locally installed packages are not treated as repository-managed', () => {
    const output = `cockpit-bookmarks:\n  Installed: 0.7.1-1\n  Candidate: 0.7.1-1\n  Version table:\n *** 0.7.1-1 100\n        100 /var/lib/dpkg/status\n`;
    assert.deepEqual(parseAptPolicy(output), {
        installed: '0.7.1-1',
        candidate: '0.7.1-1',
        repositoryAvailable: false,
    });
});

test('normalizes missing installed package to null', () => {
    const policy = parseAptPolicy(`cockpit-bookmarks:\n  Installed: (none)\n  Candidate: 0.5.1-1\n`);
    assert.deepEqual(policy, { installed: null, candidate: '0.5.1-1', repositoryAvailable: false });
});

test('normalizes unavailable candidate to null', () => {
    const policy = parseAptPolicy(`cockpit-bookmarks:\n  Installed: 0.5.0-2\n  Candidate: (none)\n`);
    assert.deepEqual(policy, { installed: '0.5.0-2', candidate: null, repositoryAvailable: false });
});

test('handles empty or unexpected apt-cache output safely', () => {
    assert.deepEqual(parseAptPolicy(''), { installed: null, candidate: null, repositoryAvailable: false });
    assert.deepEqual(parseAptPolicy('N: Unable to locate package'), { installed: null, candidate: null, repositoryAvailable: false });
});

test('reports a newer installable repository candidate', async () => {
    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            if (args[0] === 'apt-cache')
                return REPOSITORY_POLICY;
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

test('skips version comparison for a standalone deb with no repository source', async () => {
    const calls = [];
    const cockpit = {
        spawn: async args => {
            calls.push(args);
            return `cockpit-bookmarks:\n  Installed: 0.7.1-1\n  Candidate: 0.7.1-1\n  Version table:\n *** 0.7.1-1 100\n        100 /var/lib/dpkg/status\n`;
        },
    };
    assert.equal(await checkForPackageUpdate(cockpit), null);
    assert.equal(calls.length, 1);
});

test('does not report the same repository candidate version', async () => {
    let compareCalled = false;
    const cockpit = {
        spawn: async args => {
            if (args[0] === 'apt-cache')
                return `cockpit-bookmarks:\n  Installed: 0.5.0-2\n  Candidate: 0.5.0-2\n  Version table:\n *** 0.5.0-2 500\n        500 https://packages.example.test stable/main all Packages\n`;
            compareCalled = true;
            return '';
        },
    };

    assert.equal(await checkForPackageUpdate(cockpit), null);
    assert.equal(compareCalled, false);
});

test('does not report a repository candidate that dpkg says is not newer', async () => {
    const cockpit = {
        spawn: async args => {
            if (args[0] === 'apt-cache')
                return `cockpit-bookmarks:\n  Installed: 0.5.1-1\n  Candidate: 0.5.0-2\n  Version table:\n *** 0.5.1-1 100\n        100 /var/lib/dpkg/status\n     0.5.0-2 500\n        500 https://packages.example.test stable/main all Packages\n`;
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
