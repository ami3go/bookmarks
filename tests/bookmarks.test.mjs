import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_CONFIG,
    allowedUrl,
    duplicateWarnings,
    editableBookmark,
    expandUrl,
    moveService,
    normalizeConfig,
    normalizeImportedConfig,
    restoreHistoryEntry,
    storedBookmark,
    validateBookmark,
    withHistory,
} from '../src/bookmarks.js';

test('expands host placeholders including IPv6', () => {
    assert.equal(expandUrl('http://{host}:3000', 'mini-pc.local'), 'http://mini-pc.local:3000');
    assert.equal(expandUrl('http://{host}:3000', '2001:db8::1'), 'http://[2001:db8::1]:3000');
});

test('accepts only absolute HTTP and HTTPS URLs', () => {
    assert.equal(allowedUrl('http://example.test'), true);
    assert.equal(allowedUrl('https://example.test/path'), true);
    assert.equal(allowedUrl('/relative/path'), false);
    assert.equal(allowedUrl('javascript:alert(1)'), false);
});

test('normalizes legacy configurations without new fields', () => {
    const config = normalizeConfig({ services: [] });
    assert.equal(config.title, DEFAULT_CONFIG.title);
    assert.equal(config.eyebrow, 'Mini PC');
    assert.equal(config.showEyebrow, true);
    assert.deepEqual(config.history, []);
});

test('stores tags as a unique array and keeps unknown service fields', () => {
    const stored = storedBookmark({
        name: 'Grafana',
        url: 'http://{host}:3000',
        description: '',
        group: 'Monitoring',
        icon: '📊',
        tags: 'dashboard, monitoring, Dashboard',
    }, { custom: 'kept' });

    assert.equal(stored.custom, 'kept');
    assert.ok(stored.id);
    assert.deepEqual(stored.tags, ['dashboard', 'monitoring']);
    assert.equal(editableBookmark(stored).tags, 'dashboard, monitoring');
});

test('validates required fields and URL protocol', () => {
    assert.deepEqual(validateBookmark({ name: '', url: '' }, 'mini-pc'), {
        name: 'Name is required.',
        url: 'URL is required.',
    });
    assert.ok(validateBookmark({ name: 'Bad', url: '/relative' }, 'mini-pc').url);
    assert.deepEqual(validateBookmark({ name: 'Good', url: 'http://{host}:8080' }, 'mini-pc'), {});
});

test('warns about duplicate names and URLs without blocking them', () => {
    const services = [{ id: '1', name: 'Grafana', url: 'http://{host}:3000' }];
    const warnings = duplicateWarnings({
        name: 'grafana',
        url: 'http://mini-pc:3000',
    }, services, null, 'mini-pc');

    assert.equal(warnings.length, 2);
});

test('moves services without mutating the input array', () => {
    const services = ['a', 'b', 'c'];
    assert.deepEqual(moveService(services, 0, 2), ['b', 'c', 'a']);
    assert.deepEqual(services, ['a', 'b', 'c']);
});

test('records and restores configuration history', () => {
    const current = normalizeConfig({
        title: 'Before',
        services: [{ id: '1', name: 'One', url: 'http://one.test' }],
    });
    const next = { ...current, title: 'After' };
    const changed = withHistory(current, next, 'Changed title');

    assert.equal(changed.history.length, 1);
    assert.equal(changed.history[0].action, 'Changed title');
    assert.equal(changed.history[0].config.title, 'Before');

    const restored = restoreHistoryEntry(changed, changed.history[0]);
    assert.equal(restored.title, 'Before');
    assert.equal(restored.services[0].name, 'One');
});

test('normalizes imported bookmarks and assigns stable IDs', () => {
    const imported = normalizeImportedConfig({
        title: 'Imported',
        services: [{ name: 'App', url: 'http://{host}:8080', tags: ['one', 'two'] }],
    }, 'mini-pc');

    assert.equal(imported.title, 'Imported');
    assert.ok(imported.services[0].id);
    assert.deepEqual(imported.services[0].tags, ['one', 'two']);
});
