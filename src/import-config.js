import {
    HISTORY_LIMIT,
    editableBookmark,
    normalizeConfig,
    normalizeGroupOrder,
    storedBookmark,
    validateBookmark,
} from './bookmarks.js';
import { CURRENT_CONFIG_SCHEMA_VERSION, migrateConfiguration } from './config-migrations.js';
import {
    APPLICATION_LAUNCHER_TYPE,
    applicationDraft,
    buildApplicationService,
    normalizeApplicationLauncher,
    validateApplicationDraft,
} from './application-launcher.js';
import {
    TERMINAL_LAUNCHER_TYPE,
    buildLauncherService,
    launcherDraft,
    normalizeTerminalLauncher,
    terminalProviderLabel,
    validateLauncherDraft,
} from './terminal-launcher.js';

function firstValidationError(errors) {
    return Object.values(errors || {}).find(Boolean) || '';
}

function normalizeTerminalImport(service, index) {
    const normalized = normalizeTerminalLauncher(service.gottyLauncher);
    const draft = launcherDraft({ ...service, gottyLauncher: normalized });
    const error = firstValidationError(validateLauncherDraft(draft));
    if (error)
        throw new Error(`Bookmark ${index + 1}: ${error}`);
    return buildLauncherService(draft, service);
}

function normalizeApplicationImport(service, index) {
    const normalized = normalizeApplicationLauncher(service.applicationLauncher);
    const draft = applicationDraft({ ...service, applicationLauncher: normalized });
    const error = firstValidationError(validateApplicationDraft(draft));
    if (error)
        throw new Error(`Bookmark ${index + 1}: ${error}`);
    return buildApplicationService(draft, service);
}

function normalizeBookmarkImport(service, index, hostname) {
    const draft = editableBookmark(service);
    const error = firstValidationError(validateBookmark(draft, hostname));
    if (error)
        throw new Error(`Bookmark ${index + 1}: ${error}`);
    return storedBookmark(draft, service);
}

export function launcherImportSummary(service) {
    if (service?.type === TERMINAL_LAUNCHER_TYPE) {
        const launcher = normalizeTerminalLauncher(service.gottyLauncher);
        return {
            id: service.id,
            name: String(service.name || 'Terminal launcher'),
            kind: terminalProviderLabel(launcher.provider),
            command: `${launcher.binary} → ${launcher.command}${launcher.args.length ? ` ${launcher.args.join(' ')}` : ''}`,
            bind: `${launcher.address}:${launcher.port}`,
            writable: true,
            timeout: launcher.autoStopMinutes > 0 ? `${launcher.autoStopMinutes} min` : 'No timeout',
            binaryWarning: !['gotty', 'ttyd'].includes(launcher.binary.split('/').pop()?.toLowerCase()),
        };
    }

    if (service?.type === APPLICATION_LAUNCHER_TYPE) {
        const launcher = normalizeApplicationLauncher(service.applicationLauncher);
        return {
            id: service.id,
            name: String(service.name || 'Application launcher'),
            kind: 'Application',
            command: `${launcher.command}${launcher.args.length ? ` ${launcher.args.join(' ')}` : ''}`,
            bind: `${launcher.bindHost}:${launcher.port}`,
            writable: null,
            timeout: launcher.autoStopMinutes > 0 ? `${launcher.autoStopMinutes} min` : 'No timeout',
            binaryWarning: false,
        };
    }

    return null;
}

export function normalizeImportedConfiguration(value, hostname) {
    const config = normalizeConfig(migrateConfiguration(value));
    const services = config.services.map((service, index) => {
        if (!service || typeof service !== 'object')
            throw new Error(`Bookmark ${index + 1} must be an object.`);
        if (service.type === TERMINAL_LAUNCHER_TYPE)
            return normalizeTerminalImport(service, index);
        if (service.type === APPLICATION_LAUNCHER_TYPE)
            return normalizeApplicationImport(service, index);
        return normalizeBookmarkImport(service, index, hostname);
    });

    const normalized = {
        ...config,
        schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
        groupOrder: normalizeGroupOrder(services, config.groupOrder),
        services,
        history: Array.isArray(config.history) ? config.history.slice(-HISTORY_LIMIT) : [],
    };
    const launchers = services.map(launcherImportSummary).filter(Boolean);
    Object.defineProperty(normalized, 'importInfo', {
        value: { launchers },
        enumerable: false,
    });
    return normalized;
}
