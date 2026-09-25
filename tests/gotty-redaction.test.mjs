import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    TERMINAL_INSPECTION_SCRIPT,
    parseTerminalInspectionFacts,
} from '../src/terminal-inspect.js';

function inspectFixture(provider, argv) {
    const directory = mkdtempSync(join(tmpdir(), 'bookmarks-terminal-inspect-'));
    const cmdline = join(directory, 'cmdline');
    try {
        writeFileSync(cmdline, Buffer.from(`${argv.join('\0')}\0`));
        const result = spawnSync(
            'bash',
            ['-c', TERMINAL_INSPECTION_SCRIPT, 'bash', provider, '1', cmdline],
            { encoding: 'utf8' }
        );
        assert.equal(result.status, 0, result.stderr);
        return { raw: result.stdout, facts: parseTerminalInspectionFacts(result.stdout) };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

test('GoTTY host inspection handles every credential spelling without exporting the secret', () => {
    const variants = [
        ['gotty', '--credential', 'admin:s3cret', '--tls', '--permit-write', '--path', '/console', 'bash'],
        ['gotty', '--credential=admin:s3cret', '--tls', 'bash'],
        ['gotty', '-credential', 'admin:s3cret', '-m', '/console', 'bash'],
        ['gotty', '-credential=admin:s3cret', '-t', 'bash'],
        ['gotty', '-cadmin:s3cret', '-w', 'bash'],
    ];

    for (const argv of variants) {
        const { raw, facts } = inspectFixture('gotty', argv);
        assert.equal(facts.inspected, true);
        assert.equal(facts.authentication, true);
        assert.equal(raw.includes('s3cret'), false);
        assert.equal(raw.includes('admin'), false);
    }

    const detailed = inspectFixture('gotty', variants[0]).facts;
    assert.equal(detailed.tls, true);
    assert.equal(detailed.permitWrite, true);
    assert.equal(detailed.path, '/console/');
});

test('ttyd host inspection handles attached, bundled and long credential spellings', () => {
    const variants = [
        ['ttyd', '-cadmin:s3cret', 'bash'],
        ['ttyd', '-Wc', 'admin:s3cret', 'bash'],
        ['ttyd', '--cred=admin:s3cret', 'bash'],
        ['ttyd', '--credential', 'admin:s3cret', 'bash'],
        ['ttyd', '--auth-header', 'X-Auth', 'bash'],
    ];

    for (const argv of variants) {
        const { raw, facts } = inspectFixture('ttyd', argv);
        assert.equal(facts.inspected, true);
        assert.equal(facts.authentication, true);
        assert.equal(raw.includes('s3cret'), false);
        assert.equal(raw.includes('admin'), false);
    }

    assert.equal(inspectFixture('ttyd', variants[1]).facts.permitWrite, true);
});

test('ttyd option grammar does not swallow writable flags and consumes value options', () => {
    const facts = inspectFixture('ttyd', [
        'ttyd', '-B', '-W', '-d', '7', '-U', 'user', '-I', 'index.html', '-f', 'monospace', '-b', '/term', 'bash',
    ]).facts;

    assert.equal(facts.permitWrite, true);
    assert.equal(facts.path, '/term/');
    assert.equal(facts.unknownOptions, false);
});

test('terminal inspection rejects malformed PIDs before reading proc', () => {
    const result = spawnSync(
        'bash',
        ['-c', TERMINAL_INSPECTION_SCRIPT, 'bash', 'gotty', '../1'],
        { encoding: 'utf8' }
    );
    assert.notEqual(result.status, 0);
});
