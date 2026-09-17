import {
    CONFIG_PATH,
    CONFIG_SYNTAX,
    DEFAULT_CONFIG,
    MAX_CONFIG_SIZE,
    normalizeConfig,
    withHistory,
} from './bookmarks.js';
import { CURRENT_CONFIG_SCHEMA_VERSION, migrateConfiguration } from './config-migrations.js';

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

export function watchConfiguration(onConfig, onError, onMissing) {
    const file = window.cockpit.file(CONFIG_PATH, {
        syntax: CONFIG_SYNTAX,
        max_read_size: MAX_CONFIG_SIZE,
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
        max_read_size: MAX_CONFIG_SIZE,
    });

    try {
        return configurationFromContent(await file.read());
    } finally {
        file.close();
    }
}

export async function modifyConfiguration(transform, action) {
    const file = window.cockpit.file(CONFIG_PATH, {
        syntax: CONFIG_SYNTAX,
        max_read_size: MAX_CONFIG_SIZE,
        superuser: 'require',
    });

    try {
        const newContent = await file.modify(oldContent => {
            const current = configurationFromContent(oldContent);
            const next = {
                ...transform(current),
                schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
            };
            const actionText = typeof action === 'function' ? action(current, next) : action;
            return withHistory(current, next, actionText);
        });
        return configurationFromContent(newContent);
    } finally {
        file.close();
    }
}
