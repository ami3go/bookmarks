import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CURRENT_CONFIG_SCHEMA_VERSION,
    migrateConfiguration,
} from '../src/config-migrations.js';
import { configurationFromContent, emptyConfiguration } from '../src/cockpit-config.js';

test('empty configuration uses the current schema version', () => {
    assert.equal(emptyConfiguration().schemaVersion, CURRENT_CONFIG_SCHEMA_VERSION);
});

test('legacy configuration migrates launchers into Applications', () => {
    const migrated = migrateConfiguration({
        services: [
            { id: 'terminal', type: 'gotty-launcher', group: 'Terminal' },
            { id: 'app', type: 'application-launcher' },
            { id: 'bookmark', name: 'Docs', url: 'https://example.test', group: 'Links' },
        ],
    });

    assert.equal(migrated.schemaVersion, CURRENT_CONFIG_SCHEMA_VERSION);
    assert.equal(migrated.services[0].group, 'Applications');
    assert.equal(migrated.services[1].group, 'Applications');
    assert.equal(migrated.services[2].group, 'Links');
});

test('configuration boundary always exposes migrated normalized config', () => {
    const config = configurationFromContent({
        title: 'Test',
        services: [{ id: 'terminal', type: 'gotty-launcher', group: 'Old group' }],
    });

    assert.equal(config.schemaVersion, CURRENT_CONFIG_SCHEMA_VERSION);
    assert.equal(config.services[0].group, 'Applications');
});

test('future schema versions are rejected', () => {
    assert.throws(
        () => migrateConfiguration({ schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION + 1, services: [] }),
        /newer than this version supports/
    );
});
