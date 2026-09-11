import test from 'node:test';
import assert from 'node:assert/strict';

import {
    editableBookmark,
    formatEndpointDraft,
    normalizeAccent,
    normalizeEndpoints,
    parseEndpointDraft,
    serviceEndpoints,
    storedBookmark,
    validateBookmark,
} from '../src/bookmarks.js';

test('normalizes endpoint arrays and formats editor lines', () => {
    const endpoints = normalizeEndpoints([
        { label: 'LAN', url: 'http://192.168.1.20:3000' },
        'https://remote.test',
        { label: 'Duplicate', url: 'https://remote.test' },
    ]);
    assert.deepEqual(endpoints, [
        { label: 'LAN', url: 'http://192.168.1.20:3000' },
        { label: 'Address 2', url: 'https://remote.test' },
    ]);
    assert.equal(formatEndpointDraft(endpoints), 'LAN | http://192.168.1.20:3000\nAddress 2 | https://remote.test');
});

test('parses alternate address editor syntax and resolves host placeholders', () => {
    const parsed = parseEndpointDraft('LAN | http://{host}:3000\nhttps://remote.test');
    assert.deepEqual(parsed, [
        { label: 'LAN', url: 'http://{host}:3000' },
        { label: 'Address 2', url: 'https://remote.test' },
    ]);
    assert.deepEqual(serviceEndpoints({
        url: 'http://{host}:8080',
        endpoints: parsed,
    }, 'mini-pc.local').map(endpoint => endpoint.url), [
        'http://mini-pc.local:8080',
        'http://mini-pc.local:3000',
        'https://remote.test',
    ]);
});

test('stores optional endpoints, accent, and disabled status checking', () => {
    const stored = storedBookmark({
        name: 'Grafana',
        url: 'http://{host}:3000',
        endpoints: 'LAN | http://192.168.1.20:3000',
        accent: 'purple',
        statusCheck: false,
        tags: '',
        openMode: 'new-tab',
    });
    assert.deepEqual(stored.endpoints, [{ label: 'LAN', url: 'http://192.168.1.20:3000' }]);
    assert.equal(stored.accent, 'purple');
    assert.equal(stored.statusCheck, false);
    const editable = editableBookmark(stored);
    assert.equal(editable.endpoints, 'LAN | http://192.168.1.20:3000');
    assert.equal(editable.accent, 'purple');
    assert.equal(editable.statusCheck, false);
});

test('uses theme-safe accent presets and validates alternate addresses', () => {
    assert.equal(normalizeAccent('teal'), 'teal');
    assert.equal(normalizeAccent('hotpink'), 'none');
    assert.deepEqual(validateBookmark({
        name: 'Good',
        url: 'http://{host}:8080',
        endpoints: 'LAN | http://192.168.1.10:8080',
    }, 'mini-pc'), {});
    assert.ok(validateBookmark({
        name: 'Bad alternate',
        url: 'http://{host}:8080',
        endpoints: 'LAN | ssh://192.168.1.10',
    }, 'mini-pc').endpoints);
});
