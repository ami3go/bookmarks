import {
    CONFIG_PATH,
    CONFIG_SYNTAX,
    DEFAULT_CONFIG,
    MAX_CONFIG_SIZE,
    normalizeConfig,
    withHistory,
} from './bookmarks.js';

export function emptyConfiguration() {
    return {
        ...DEFAULT_CONFIG,
        groupOrder: [],
        services: [],
        history: [],
    };
}

export function configurationFromContent(content) {
    return content === null ? emptyConfiguration() : normalizeConfig(content);
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
            onConfig(normalizeConfig(content));
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
            const next = transform(current);
            const actionText = typeof action === 'function' ? action(current, next) : action;
            return withHistory(current, next, actionText);
        });
        return normalizeConfig(newContent);
    } finally {
        file.close();
    }
}
