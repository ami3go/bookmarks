import test from 'node:test';
import assert from 'node:assert/strict';

import {
    checkTerminalProviderCompatibility,
    compareTerminalProviderVersions,
    evaluateTerminalProviderCompatibility,
    parseTerminalProviderVersion,
    terminalProviderCompatibilityMessage,
} from '../src/terminal-provider-compatibility.js';

const GOTTY_HELP = [
    '--address value',
    '--port value',
    '--path value',
    '--permit-write',
].join('\n');

const TTYD_HELP = [
    '--interface value',
    '--port value',
    '--writable',
    '--base-path value',
].join('\n');

test('parses provider versions from common GoTTY and ttyd output', () => {
    assert.deepEqual(parseTerminalProviderVersion('gotty version v1.8.0'), {
        major: 1, minor: 8, patch: 0, text: '1.8.0',
    });
    assert.deepEqual(parseTerminalProviderVersion('ttyd version 1.7.7-40e79c7'), {
        major: 1, minor: 7, patch: 7, text: '1.7.7',
    });
    assert.equal(parseTerminalProviderVersion('unknown_version'), null);
});

test('compares semantic provider versions numerically', () => {
    assert.equal(compareTerminalProviderVersions('1.2.0', '1.2.0'), 0);
    assert.equal(compareTerminalProviderVersions('1.1.9', '1.2.0'), -1);
    assert.equal(compareTerminalProviderVersions('1.10.0', '1.7.4'), 1);
});

test('rejects legacy GoTTY before the maintained path-capable releases', () => {
    const result = evaluateTerminalProviderCompatibility('gotty', 'gotty version 1.1.0', GOTTY_HELP.replace('--path value\n', ''));
    assert.equal(result.supported, false);
    assert.equal(result.reason, 'version-too-old');
    assert.equal(result.minimumVersion, '1.2.0');
    assert.match(terminalProviderCompatibilityMessage(result), /unsupported/i);
});

test('rejects ttyd releases that predate the writable CLI contract', () => {
    const oldHelp = TTYD_HELP.replace('--writable\n', '--readonly\n');
    const result = evaluateTerminalProviderCompatibility('ttyd', 'ttyd version 1.7.3', oldHelp);
    assert.equal(result.supported, false);
    assert.equal(result.reason, 'version-too-old');
    assert.equal(result.minimumVersion, '1.7.4');
});

test('rejects a fork that reports a new version but lacks required flags', () => {
    const result = evaluateTerminalProviderCompatibility('ttyd', 'ttyd version 9.9.9', '--interface\n--port\n--writable');
    assert.equal(result.supported, false);
    assert.equal(result.reason, 'missing-options');
    assert.deepEqual(result.missingOptions, ['--base-path']);
    assert.match(terminalProviderCompatibilityMessage(result), /old or incompatible fork/i);
});

test('accepts an unversioned custom build when required CLI capabilities are present', () => {
    const result = evaluateTerminalProviderCompatibility('gotty', 'unknown_version', GOTTY_HELP);
    assert.equal(result.supported, true);
    assert.equal(result.versionVerified, false);
    assert.match(terminalProviderCompatibilityMessage(result), /version string could not be identified/i);
});

test('checks binary version and help through Cockpit', async () => {
    const calls = [];
    const cockpit = {
        spawn: async (argv, options) => {
            calls.push({ argv, options });
            if (argv[1] === '--version')
                return 'ttyd version 1.7.7';
            if (argv[1] === '--help')
                return TTYD_HELP;
            throw new Error('unexpected command');
        },
        message: error => error.message,
    };

    const result = await checkTerminalProviderCompatibility(cockpit, 'ttyd', '/usr/bin/ttyd');
    assert.equal(result.supported, true);
    assert.equal(result.version, '1.7.7');
    assert.deepEqual(calls.map(call => call.argv), [
        ['/usr/bin/ttyd', '--version'],
        ['/usr/bin/ttyd', '--help'],
    ]);
    assert.ok(calls.every(call => call.options.err === 'out'));
});

test('reports a missing provider executable without treating it as a version problem', async () => {
    const cockpit = {
        spawn: async () => { throw new Error('not found'); },
        message: error => error.message,
    };
    const result = await checkTerminalProviderCompatibility(cockpit, 'gotty', '/missing/gotty');
    assert.equal(result.available, false);
    assert.equal(result.supported, false);
    assert.equal(result.reason, 'not-runnable');
    assert.match(terminalProviderCompatibilityMessage(result), /not available/i);
});
