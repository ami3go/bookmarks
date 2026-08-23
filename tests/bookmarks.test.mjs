import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_CONFIG,
    allowedUrl,
    bookmarkWithFavorite,
    bookmarkWithGroup,
    duplicateBookmark,
    duplicateWarnings,
    editableBookmark,
    expandUrl,
    findBookmarkIndex,
    moveGroup,
    moveService,
    normalizeConfig,
    normalizeDisplayMode,
    normalizeGroupOrder,
    normalizeImportedConfig,
    normalizeOpenMode,
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
    assert.equal(config.displayMode, 'cards');
    assert.deepEqual(config.groupOrder, []);
    assert.deepEqual(config.history, []);
});

test('normalizes supported display modes and rejects unknown modes', () => {
    assert.equal(normalizeDisplayMode('cards'), 'cards');
    assert.equal(normalizeDisplayMode('compact'), 'compact');
    assert.equal(normalizeDisplayMode('unknown'), 'cards');
    assert.equal(normalizeConfig({ displayMode: 'compact', services: [] }).displayMode, 'compact');
});

test('normalizes bookmark opening behavior with new-tab as the default', () => {
    assert.equal(normalizeOpenMode('new-tab'), 'new-tab');
    assert.equal(normalizeOpenMode('same-tab'), 'same-tab');
    assert.equal(normalizeOpenMode('unknown'), 'new-tab');

    const stored = storedBookmark({
        name: 'Cockpit',
        url: 'https://{host}:9090',
        openMode: 'same-tab',
    });
    assert.equal(stored.openMode, 'same-tab');
    assert.equal(editableBookmark(stored).openMode, 'same-tab');

    const reset = storedBookmark({
        ...editableBookmark(stored),
        openMode: 'new-tab',
    }, stored);
    assert.equal('openMode' in reset, false);
});

test('normalizes explicit group order and appends new groups predictably', () => {
    const services = [
        { name: 'Grafana', group: 'Monitoring' },
        { name: 'Files', group: 'Storage' },
        { name: 'Home', group: 'Apps' },
    ];

    assert.deepEqual(
        normalizeGroupOrder(services, ['Storage', 'Missing', 'Storage', 'Monitoring']),
        ['Storage', 'Monitoring', 'Apps']
    );
    assert.deepEqual(normalizeGroupOrder(services), ['Monitoring', 'Storage', 'Apps']);
});

test('moves groups without mutating the input order', () => {
    const groups = ['Monitoring', 'Storage', 'Apps'];
    assert.deepEqual(moveGroup(groups, 'Storage', -1), ['Storage', 'Monitoring', 'Apps']);
    assert.deepEqual(moveGroup(groups, 'Storage', 1), ['Monitoring', 'Apps', 'Storage']);
    assert.deepEqual(groups, ['Monitoring', 'Storage', 'Apps']);
});

test('stores tags as a unique array and keeps unknown service fields', () => {
    const stored = storedBookmark({
        name: 'Grafana',
        url: 'http://{host}:3000',
        description: '',
        group: 'Monitoring',
        icon: '📊',
        tags: 'dashboard, monitoring, Dashboard',
        openMode: 'new-tab',
    }, { custom: 'kept', favorite: true });

    assert.equal(stored.custom, 'kept');
    assert.equal(stored.favorite, true);
    assert.ok(stored.id);
    assert.deepEqual(stored.tags, ['dashboard', 'monitoring']);
    assert.equal(editableBookmark(stored).tags, 'dashboard, monitoring');
});

test('duplicates bookmarks with a fresh id and collision-free name', () => {
    const source = {
        id: 'one',
        name: 'Grafana',
        url: 'http://{host}:3000',
        group: 'Monitoring',
        favorite: true,
        openMode: 'same-tab',
    };
    const services = [source, { id: 'two', name: 'Grafana copy', url: 'http://other.test' }];
    const duplicated = duplicateBookmark(source, services);

    assert.notEqual(duplicated.id, source.id);
    assert.equal(duplicated.name, 'Grafana copy 2');
    assert.equal(duplicated.url, source.url);
    assert.equal(duplicated.group, 'Monitoring');
    assert.equal(duplicated.favorite, true);
    assert.equal(duplicated.openMode, 'same-tab');
});

test('updates favorite and group without mutating the source bookmark', () => {
    const source = { id: 'one', name: 'Files', url: 'http://files.test', group: 'Storage' };
    assert.deepEqual(bookmarkWithFavorite(source, true), { ...source, favorite: true });
    assert.equal('favorite' in bookmarkWithFavorite({ ...source, favorite: true }, false), false);
    assert.equal(bookmarkWithGroup(source, 'Apps').group, 'Apps');
    assert.equal('group' in bookmarkWithGroup(source, 'Ungrouped'), false);
    assert.equal(source.group, 'Storage');
});

test('uses stable ids as authoritative mutation targets', () => {
    const target = {
        index: 0,
        service: { id: 'missing-id', name: 'Same', url: 'http://same.test' },
    };
    const services = [
        { id: 'other-id', name: 'Same', url: 'http://same.test' },
    ];

    assert.equal(findBookmarkIndex(services, target), -1);
});

test('keeps legacy field matching for bookmarks without ids', () => {
    const target = {
        index: 0,
        service: { name: 'Legacy', url: 'http://legacy.test' },
    };
    const services = [
        { name: 'Legacy', url: 'http://legacy.test' },
    ];

    assert.equal(findBookmarkIndex(services, target), 0);
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

test('records and restores configuration history including display and group order', () => {
    const current = normalizeConfig({
        title: 'Before',
        displayMode: 'cards',
        groupOrder: ['Storage', 'Monitoring'],
        services: [
            { id: '1', name: 'One', url: 'http://one.test', group: 'Monitoring' },
            { id: '2', name: 'Two', url: 'http://two.test', group: 'Storage' },
        ],
    });
    const next = {
        ...current,
        title: 'After',
        displayMode: 'compact',
        groupOrder: ['Monitoring', 'Storage'],
    };
    const changed = withHistory(current, next, 'Changed page layout');

    assert.equal(changed.history.length, 1);
    assert.equal(changed.history[0].action, 'Changed page layout');
    assert.equal(changed.history[0].config.title, 'Before');
    assert.equal(changed.history[0].config.displayMode, 'cards');
    assert.deepEqual(changed.history[0].config.groupOrder, ['Storage', 'Monitoring']);

    const restored = restoreHistoryEntry(changed, changed.history[0]);
    assert.equal(restored.title, 'Before');
    assert.equal(restored.displayMode, 'cards');
    assert.deepEqual(restored.groupOrder, ['Storage', 'Monitoring']);
    assert.equal(restored.services[0].name, 'One');
});

test('normalizes imported bookmarks and preserves group order and service metadata', () => {
    const imported = normalizeImportedConfig({
        title: 'Imported',
        displayMode: 'compact',
        groupOrder: ['Apps', 'Monitoring'],
        services: [
            { name: 'Grafana', url: 'http://{host}:3000', group: 'Monitoring', favorite: true, openMode: 'same-tab' },
            { name: 'App', url: 'http://{host}:8080', group: 'Apps', tags: ['one', 'two'] },
        ],
    }, 'mini-pc');

    assert.equal(imported.title, 'Imported');
    assert.equal(imported.displayMode, 'compact');
    assert.deepEqual(imported.groupOrder, ['Apps', 'Monitoring']);
    assert.ok(imported.services[1].id);
    assert.equal(imported.services[0].favorite, true);
    assert.equal(imported.services[0].openMode, 'same-tab');
    assert.deepEqual(imported.services[1].tags, ['one', 'two']);
});
