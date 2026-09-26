export const CURRENT_CONFIG_SCHEMA_VERSION = 2;

const LEGACY_SCHEMA_VERSION = 0;
const APPLICATIONS_GROUP = 'Applications';
const LAUNCHER_TYPES = new Set(['gotty-launcher', 'application-launcher']);

function schemaVersionOf(value) {
    const version = Number(value?.schemaVersion);
    if (!Number.isInteger(version) || version < 0)
        return LEGACY_SCHEMA_VERSION;
    return version;
}

function migrateLegacyToV1(config) {
    const services = Array.isArray(config.services)
        ? config.services.map(service => {
            if (!service || typeof service !== 'object' || !LAUNCHER_TYPES.has(service.type))
                return service;
            if (String(service.group || '').trim() === APPLICATIONS_GROUP)
                return service;
            return { ...service, group: APPLICATIONS_GROUP };
        })
        : config.services;

    return {
        ...config,
        schemaVersion: 1,
        services,
    };
}

function commandBasename(value) {
    return String(value || '').trim().split('/').pop()?.toLowerCase() || '';
}

function isAgentOfEmpiresLauncher(service) {
    if (service?.type !== 'application-launcher')
        return false;
    const launcher = service.applicationLauncher || {};
    const args = Array.isArray(launcher.args) ? launcher.args : [];
    const urlArgs = Array.isArray(launcher.urlArgs) ? launcher.urlArgs : [];
    return commandBasename(launcher.command) === 'aoe'
        && args[0] === 'serve'
        && commandBasename(launcher.urlCommand || launcher.command) === 'aoe'
        && urlArgs[0] === 'url';
}

function migrateV1ToV2(config) {
    const services = Array.isArray(config.services)
        ? config.services.map(service => {
            if (!isAgentOfEmpiresLauncher(service))
                return service;
            const launcher = service.applicationLauncher || {};
            if (Number(launcher.autoStopMinutes) === 0)
                return service;
            return {
                ...service,
                applicationLauncher: {
                    ...launcher,
                    autoStopMinutes: 0,
                },
            };
        })
        : config.services;

    return {
        ...config,
        schemaVersion: 2,
        services,
    };
}

export function migrateConfiguration(value) {
    if (!value || typeof value !== 'object')
        return value;

    let config = value;
    let version = schemaVersionOf(config);

    if (version > CURRENT_CONFIG_SCHEMA_VERSION)
        throw new Error(`Configuration schema ${version} is newer than this version supports (${CURRENT_CONFIG_SCHEMA_VERSION}).`);

    if (version === LEGACY_SCHEMA_VERSION) {
        config = migrateLegacyToV1(config);
        version = 1;
    }

    if (version === 1) {
        config = migrateV1ToV2(config);
        version = 2;
    }

    if (version !== CURRENT_CONFIG_SCHEMA_VERSION)
        throw new Error(`Configuration schema ${version} could not be migrated to ${CURRENT_CONFIG_SCHEMA_VERSION}.`);

    return config;
}
