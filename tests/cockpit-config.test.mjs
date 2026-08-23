import test from 'node:test';
import assert from 'node:assert/strict';

import {
    configurationFromContent,
    emptyConfiguration,
} from '../src/cockpit-config.js';

test('creates a fresh empty configuration without sharing arrays', () => {
    const first = emptyConfiguration();
    const second = emptyConfiguration();

    assert.notEqual(first.services, second.services);
    assert.notEqual(first.history, second.history);
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
