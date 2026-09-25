import {
    CONFIG_PATH,
    CONFIG_SYNTAX,
    DEFAULT_CONFIG,
    MAX_CONFIG_SIZE,
    normalizeConfig,
    withHistory,
} from './bookmarks.js';
import { CURRENT_CONFIG_SCHEMA_VERSION, migrateConfiguration } from './config-migrations.js';

export const MAX_CONFIG_READ_SIZE = MAX_CONFIG_SIZE * 4;
export const OVERSIZE_REPAIR_READ_SIZE = MAX_CONFIG_SIZE * 32;
export const CONFIG_WRITE_RETRIES = 5;

export function emptyConfiguration() {
    return {
        ...DEFAULT_CONFIG,
        schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
        groupOrder: [],
        services: [],
        history: [],
    };
}

export function configurationFromContent(content) {
    return content === null
        ? emptyConfiguration()
        : normalizeConfig(migrateConfiguration(content));
}

export function configurationSizeBytes(value) {
    return new TextEncoder().encode(CONFIG_SYNTAX.stringify(value)).byteLength;
}

export function fitConfigurationForWrite(value) {
    let config = {
        ...value,
        history: Array.isArray(value?.history) ? [...value.history] : [],
    };
    let historyTrimmed = 0;
    let size = configurationSizeBytes(config);

    while (size > MAX_CONFIG_SIZE && config.history.length) {
        config = { ...config, history: config.history.slice(1) };
        historyTrimmed += 1;
        size = configurationSizeBytes(config);
    }

    if (size > MAX_CONFIG_SIZE) {
        throw new Error(
            `Configuration is ${size.toLocaleString()} bytes, exceeding the ${MAX_CONFIG_SIZE.toLocaleString()} byte write limit. Remove bookmarks or large fields before saving.`
        );
    }

    return { config, historyTrimmed, size };
}

function deferredResult(request, mapper = (...values) => values[0]) {
    if (request?.done && request?.fail) {
        return new Promise((resolve, reject) => {
            request.done((...values) => resolve(mapper(...values)));
            request.fail(reject);
        });
    }
    return Promise.resolve(request).then(value => mapper(value));
}

async function readWithTag(file) {
    return deferredResult(file.read(), (content, tag) => {
        if (Array.isArray(content) && tag === undefined && content.length === 2)
            return { content: content[0], tag: content[1] };
        if (content && typeof content === 'object' && 'content' in content && 'tag' in content && tag === undefined)
            return content;
        return { content, tag };
    });
}

async function replaceWithTag(file, content, tag) {
    return deferredResult(file.replace(content, tag));
}

function isChangeConflict(error) {
    const problem = String(error?.problem || error?.name || '');
    const text = String(error?.message || error || '');
    return problem === 'change-conflict' || /change-conflict/i.test(text);
}

export function canRepairOversizedConfiguration(error) {
    const problem = String(error?.problem || error?.name || '').toLowerCase();
    const text = String(error?.message || error || '').toLowerCase();
    return problem === 'too-large' || problem === 'too_large' ||
        /too large|max[_ -]?read[_ -]?size|read size|size limit|exceeds?.*size/.test(text);
}

export function watchConfiguration(onConfig, onError, onMissing) {
    const file = window.cockpit.file(CONFIG_PATH, {
        syntax: CONFIG_SYNTAX,
        max_read_size: MAX_CONFIG_READ_SIZE,
    });
    let active = true;
    const watch = file.watch((content, _tag, error) => {
        if (!active)
            return;

        if (error) {
            onError?.(error);
            return;
        }

        if (content === null) {
            onConfig(emptyConfiguration());
            onMissing?.();
            return;
        }

        try {
            onConfig(configurationFromContent(content));
        } catch (loadError) {
            onError?.(loadError);
        }
    });

    return () => {
        active = false;
        watch.remove();
        file.close();
    };
}

export async function readConfiguration() {
    const file = window.cockpit.file(CONFIG_PATH, {
        syntax: CONFIG_SYNTAX,
        max_read_size: MAX_CONFIG_READ_SIZE,
    });

    try {
        return configurationFromContent(await file.read());
    } finally {
        file.close();
    }
}

export async function repairOversizedConfigurationHistory() {
    const file = window.cockpit.file(CONFIG_PATH, {
        syntax: CONFIG_SYNTAX,
        max_read_size: OVERSIZE_REPAIR_READ_SIZE,
        superuser: 'require',
    });

    try {
        const { content, tag } = await readWithTag(file);
        if (content === null)
            throw new Error('No configuration file exists to repair.');
        const current = configurationFromContent(content);
        const previousHistoryCount = current.history.length;
        const repaired = {
            ...current,
            schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
            history: [],
        };
        const fitted = fitConfigurationForWrite(repaired);
        await replaceWithTag(file, fitted.config, tag);
        return {
            config: configurationFromContent(fitted.config),
            removedHistoryEntries: previousHistoryCount,
            size: fitted.size,
        };
    } finally {
        file.close();
    }
}

export async function modifyConfiguration(transform, action) {
    const file = window.cockpit.file(CONFIG_PATH, {
        syntax: CONFIG_SYNTAX,
        max_read_size: MAX_CONFIG_READ_SIZE,
        superuser: 'require',
    });

    try {
        for (let attempt = 0; attempt < CONFIG_WRITE_RETRIES; attempt += 1) {
            const { content, tag } = await readWithTag(file);
            const current = configurationFromContent(content);

            // Run the transform outside Cockpit's Deferred callbacks. Exceptions
            // therefore reject this async function instead of escaping a file.modify()
            // callback and leaving the UI permanently pending.
            const transformed = transform(current);
            const next = {
                ...transformed,
                schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
            };
            const actionText = typeof action === 'function' ? action(current, next) : action;
            const withSnapshot = {
                ...withHistory(current, next, actionText),
                schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
            };
            const fitted = fitConfigurationForWrite(withSnapshot);

            try {
                await replaceWithTag(file, fitted.config, tag);
                const result = configurationFromContent(fitted.config);
                Object.defineProperty(result, 'writeInfo', {
                    value: {
                        historyTrimmed: fitted.historyTrimmed,
                        size: fitted.size,
                    },
                    enumerable: false,
                });
                return result;
            } catch (error) {
                if (!isChangeConflict(error) || attempt + 1 >= CONFIG_WRITE_RETRIES)
                    throw error;
            }
        }

        throw new Error('Configuration could not be updated after repeated concurrent changes.');
    } finally {
        file.close();
    }
}
