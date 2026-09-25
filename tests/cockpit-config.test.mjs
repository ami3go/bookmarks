import test from 'node:test';
import assert from 'node:assert/strict';

import {
    OVERSIZE_REPAIR_READ_SIZE,
    canRepairOversizedConfiguration,
    configurationFromContent,
    configurationSizeBytes,
    emptyConfiguration,
    fitConfigurationForWrite,
    modifyConfiguration,
    repairOversizedConfigurationHistory,
} from '../src/cockpit-config.js';
import { MAX_CONFIG_SIZE } from '../src/bookmarks.js';

function deferredSuccess(...values) {
    return {
        done(callback) {
            queueMicrotask(() => callback(...values));
            return this;
        },
        fail() {
            return this;
        },
    };
}

function deferredFailure(error) {
    return {
        done() {
            return this;
        },
        fail(callback) {
            queueMicrotask(() => callback(error));
            return this;
        },
    };
}

function installCockpitFile(file, captureOptions = null) {
    const previous = globalThis.window;
    globalThis.window = {
        cockpit: {
            file: (_path, options) => {
                captureOptions?.(options);
                return file;
            },
        },
    };
    return () => {
        if (previous === undefined)
            delete globalThis.window;
        else
            globalThis.window = previous;
    };
}

test('creates a fresh empty configuration without sharing arrays', () => {
    const first = emptyConfiguration();
    const second = emptyConfiguration();

    assert.notEqual(first.groupOrder, second.groupOrder);
    assert.notEqual(first.services, second.services);
    assert.notEqual(first.history, second.history);
    assert.deepEqual(first.groupOrder, []);
    assert.deepEqual(first.services, []);
    assert.deepEqual(first.history, []);
});

test('normalizes watched configuration content and handles missing files', () => {
    const missing = configurationFromContent(null);
    assert.deepEqual(missing.services, []);

    const config = configurationFromContent({
        title: 'Test',
        services: [{ name: 'One', url: 'http://one.test' }],
    });
    assert.equal(config.title, 'Test');
    assert.equal(config.displayMode, 'cards');
    assert.deepEqual(config.groupOrder, ['Ungrouped']);
});

test('measures configuration size as UTF-8 bytes', () => {
    const ascii = configurationSizeBytes({ services: [], title: 'abc' });
    const unicode = configurationSizeBytes({ services: [], title: '🚀🚀🚀' });
    assert.ok(unicode > ascii);
});

test('drops oldest history entries before rejecting an oversized write', () => {
    const largeSnapshot = text => ({ id: text[0], config: { services: [], note: text } });
    const payload = 'x'.repeat(430000);
    const fitted = fitConfigurationForWrite({
        services: [{ name: 'One', url: 'http://one.test' }],
        history: [largeSnapshot(`a${payload}`), largeSnapshot(`b${payload}`), largeSnapshot(`c${payload}`)],
    });

    assert.ok(fitted.size <= MAX_CONFIG_SIZE);
    assert.equal(fitted.historyTrimmed, 1);
    assert.equal(fitted.config.history[0].id, 'b');
});

test('rejects a configuration that cannot fit even without history', () => {
    assert.throws(() => fitConfigurationForWrite({
        services: [{ name: 'Huge', url: 'http://huge.test', description: 'x'.repeat(MAX_CONFIG_SIZE + 1000) }],
        history: [],
    }), /exceeding the .* write limit/i);
});

test('recognizes only read-size errors as eligible for destructive history repair', () => {
    assert.equal(canRepairOversizedConfiguration({ problem: 'too-large' }), true);
    assert.equal(canRepairOversizedConfiguration(new Error('maximum read size exceeded')), true);
    assert.equal(canRepairOversizedConfiguration(new Error('invalid JSON at line 2')), false);
});

test('oversized repair performs one larger privileged read and removes history only', async () => {
    const current = {
        schemaVersion: 1,
        title: 'Keep me',
        services: [{ name: 'One', url: 'http://one.test' }],
        history: [
            { id: 'old-1', config: { services: [] } },
            { id: 'old-2', config: { services: [] } },
        ],
    };
    let replaced = null;
    let replaceTag = null;
    let options = null;
    const file = {
        read: () => deferredSuccess(current, 'repair-tag'),
        replace(content, tag) {
            replaced = content;
            replaceTag = tag;
            return deferredSuccess();
        },
        close() {},
    };
    const restore = installCockpitFile(file, value => { options = value; });
    try {
        const result = await repairOversizedConfigurationHistory();
        assert.equal(options.max_read_size, OVERSIZE_REPAIR_READ_SIZE);
        assert.equal(options.superuser, 'require');
        assert.equal(replaceTag, 'repair-tag');
        assert.equal(replaced.title, 'Keep me');
        assert.equal(replaced.services.length, 1);
        assert.deepEqual(replaced.history, []);
        assert.equal(result.removedHistoryEntries, 2);
        assert.ok(result.size <= MAX_CONFIG_SIZE);
    } finally {
        restore();
    }
});

test('transform exceptions reject instead of leaving modify pending', async () => {
    let replaceCalls = 0;
    const file = {
        read: () => deferredSuccess({ schemaVersion: 1, services: [] }, 'tag-1'),
        replace: () => {
            replaceCalls += 1;
            return deferredSuccess();
        },
        close() {},
    };
    const restore = installCockpitFile(file);
    try {
        await assert.rejects(
            modifyConfiguration(() => { throw new Error('transform exploded'); }, 'test'),
            /transform exploded/
        );
        assert.equal(replaceCalls, 0);
    } finally {
        restore();
    }
});

test('retries one change conflict with a fresh read and tag', async () => {
    let reads = 0;
    let replaces = 0;
    const file = {
        read() {
            reads += 1;
            return deferredSuccess({ schemaVersion: 1, services: [] }, `tag-${reads}`);
        },
        replace(_content, tag) {
            replaces += 1;
            if (replaces === 1) {
                const error = new Error('change-conflict');
                error.problem = 'change-conflict';
                return deferredFailure(error);
            }
            assert.equal(tag, 'tag-2');
            return deferredSuccess();
        },
        close() {},
    };
    const restore = installCockpitFile(file);
    try {
        const result = await modifyConfiguration(current => ({
            ...current,
            services: [{ name: 'One', url: 'http://one.test' }],
        }), 'Added one');
        assert.equal(reads, 2);
        assert.equal(replaces, 2);
        assert.equal(result.services.length, 1);
    } finally {
        restore();
    }
});

test('persistent change conflicts reject after the retry budget', async () => {
    let replaces = 0;
    const file = {
        read: () => deferredSuccess({ schemaVersion: 1, services: [] }, `tag-${replaces}`),
        replace() {
            replaces += 1;
            const error = new Error('change-conflict');
            error.problem = 'change-conflict';
            return deferredFailure(error);
        },
        close() {},
    };
    const restore = installCockpitFile(file);
    try {
        await assert.rejects(
            modifyConfiguration(current => current, 'test'),
            /change-conflict/
        );
        assert.equal(replaces, 5);
    } finally {
        restore();
    }
});
