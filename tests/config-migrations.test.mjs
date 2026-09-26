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

test('schema 1 migrates existing Agent of Empires timeout to never', () => {
    const migrated = migrateConfiguration({
        schemaVersion: 1,
        services: [{
            id: 'aoe',
            type: 'application-launcher',
            name: 'Agent of Empires',
            applicationLauncher: {
                command: 'aoe',
                args: ['serve', '--host', '0.0.0.0'],
                urlCommand: 'aoe',
                urlArgs: ['url'],
                autoStopMinutes: 120,
            },
        }],
    });

    assert.equal(migrated.schemaVersion, CURRENT_CONFIG_SCHEMA_VERSION);
    assert.equal(migrated.services[0].applicationLauncher.autoStopMinutes, 0);
});

test('AoE timeout migration does not change ordinary application launchers', () => {
    const migrated = migrateConfiguration({
        schemaVersion: 1,
        services: [{
            id: 'custom',
            type: 'application-launcher',
            applicationLauncher: {
                command: 'example-server',
                args: ['serve'],
                urlCommand: 'example-server',
                urlArgs: ['url'],
                autoStopMinutes: 120,
            },
        }],
    });

    assert.equal(migrated.services[0].applicationLauncher.autoStopMinutes, 120);
});

test('schema 2 preserves an explicit later AoE timeout choice', () => {
    const migrated = migrateConfiguration({
        schemaVersion: 2,
        services: [{
            id: 'aoe',
            type: 'application-launcher',
            applicationLauncher: {
                command: 'aoe',
                args: ['serve'],
                urlCommand: 'aoe',
                urlArgs: ['url'],
                autoStopMinutes: 120,
            },
        }],
    });

    assert.equal(migrated.services[0].applicationLauncher.autoStopMinutes, 120);
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
