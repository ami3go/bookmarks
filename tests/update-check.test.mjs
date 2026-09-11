import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAptPolicy } from '../src/update-check.js';

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
