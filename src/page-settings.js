import { DEFAULT_CONFIG, normalizeDisplayMode } from './bookmarks.js';

export function pageSettingsFrom(config = DEFAULT_CONFIG) {
    return {
        title: String(config.title || DEFAULT_CONFIG.title),
        subtitle: String(config.subtitle || ''),
        eyebrow: String(config.eyebrow ?? DEFAULT_CONFIG.eyebrow),
        showEyebrow: config.showEyebrow !== false,
        showHeader: config.showHeader !== false,
        showTitle: config.showTitle !== false,
        showSearch: config.showSearch !== false,
        displayMode: normalizeDisplayMode(config.displayMode),
    };
}

export function applyPageSettings(config, draft) {
    const settings = pageSettingsFrom(draft);
    return {
        ...config,
        ...settings,
        title: settings.title.trim(),
        subtitle: settings.subtitle.trim(),
        eyebrow: settings.eyebrow.trim(),
    };
}
