export const CONFIG_PATH = '/etc/cockpit/cockpit-bookmarks.json';
export const MAX_CONFIG_SIZE = 1048576;
export const HISTORY_LIMIT = 10;
export const EDIT_MODE_TIMEOUT_MS = 120000;
export const DISPLAY_MODES = ['cards', 'compact'];
export const OPEN_MODES = ['new-tab', 'same-tab'];
export const ACCENT_PRESETS = [
    { value: 'none', label: 'Default' },
    { value: 'blue', label: 'Blue' },
    { value: 'green', label: 'Green' },
    { value: 'teal', label: 'Teal' },
    { value: 'purple', label: 'Purple' },
    { value: 'orange', label: 'Orange' },
    { value: 'red', label: 'Red' },
];

export const DEFAULT_CONFIG = {
    title: 'Cockpit Bookmarks',
    subtitle: 'Services hosted on this mini PC',
    eyebrow: 'Mini PC',
    showEyebrow: true,
    showHeader: true,
    showTitle: true,
    showSearch: true,
    displayMode: 'cards',
    groupOrder: [],
    services: [],
    history: [],
};

export const EMPTY_BOOKMARK = {
    name: '',
    url: '',
    endpoints: '',
    description: '',
    group: '',
    icon: '',
    accent: 'none',
    tags: '',
    openMode: 'new-tab',
    statusCheck: true,
};

export const ICON_PRESETS = [
    '🔗', '🌐', '🖥️', '📊', '📈', '📦', '🗄️', '💾', '📁', '🔒',
    '🛠️', '🎛️', '⚙️', '🏠', '☁️', '🧭', '🧪', '📡', '🎥', '🎵',
];

export const CONFIG_SYNTAX = {
    parse: JSON.parse,
    stringify: value => `${JSON.stringify(value, null, 2)}\n`,
};

export function miniPcHost(hostname) {
    const host = String(hostname || '');
    return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

export function expandUrl(url, hostname) {
    return String(url || '').replaceAll('{host}', miniPcHost(hostname));
}

export function allowedUrl(url) {
    const value = String(url || '').trim();
    if (!/^https?:\/\//i.test(value))
        return false;

    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

export function normalizeAccent(value) {
    const normalized = String(value || 'none').trim().toLowerCase();
    return ACCENT_PRESETS.some(option => option.value === normalized) ? normalized : 'none';
}

export function normalizeEndpoints(value) {
    if (!Array.isArray(value))
        return [];

    const result = [];
    const seen = new Set();
    value.forEach((entry, index) => {
        const endpoint = typeof entry === 'string'
            ? { label: `Address ${index + 1}`, url: entry }
            : entry;
        if (!endpoint || typeof endpoint !== 'object')
            return;
        const url = String(endpoint.url || '').trim();
        if (!url)
            return;
        const key = url.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        result.push({
            label: String(endpoint.label || `Address ${index + 1}`).trim() || `Address ${index + 1}`,
            url,
        });
    });
    return result;
}

export function parseEndpointDraft(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const separator = line.indexOf('|');
            if (separator === -1)
                return { label: `Address ${index + 1}`, url: line.trim() };
            const label = line.slice(0, separator).trim() || `Address ${index + 1}`;
            const url = line.slice(separator + 1).trim();
            return { label, url };
        });
}

export function formatEndpointDraft(value) {
    return normalizeEndpoints(value)
        .map(endpoint => `${endpoint.label} | ${endpoint.url}`)
        .join('\n');
}

export function serviceEndpoints(service, hostname) {
    const raw = [
        { label: 'Primary', url: String(service?.url || '').trim() },
        ...normalizeEndpoints(service?.endpoints),
    ];
    const seen = new Set();
    return raw
        .map((endpoint, index) => ({
            label: endpoint.label || (index === 0 ? 'Primary' : `Address ${index}`),
            url: expandUrl(endpoint.url, hostname),
            primary: index === 0,
        }))
        .filter(endpoint => allowedUrl(endpoint.url))
        .filter(endpoint => {
            const key = endpoint.url.toLowerCase();
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
}

export function normalizeDisplayMode(value) {
    return DISPLAY_MODES.includes(value) ? value : DEFAULT_CONFIG.displayMode;
}

export function normalizeOpenMode(value) {
    return OPEN_MODES.includes(value) ? value : 'new-tab';
}

export function serviceGroup(service) {
    return String(service?.group || '').trim() || 'Ungrouped';
}

export function groupNames(services) {
    return [...new Set(services.map(serviceGroup))];
}

export function normalizeGroupOrder(services, preferredOrder = []) {
    const available = groupNames(services);
    const availableSet = new Set(available);
    const result = [];
    const seen = new Set();

    if (Array.isArray(preferredOrder)) {
        for (const value of preferredOrder) {
            const group = String(value || '').trim();
            if (availableSet.has(group) && !seen.has(group)) {
                result.push(group);
                seen.add(group);
            }
        }
    }

    for (const group of available) {
        if (!seen.has(group)) {
            result.push(group);
            seen.add(group);
        }
    }

    return result;
}

export function moveGroup(groupOrder, group, direction) {
    const order = [...groupOrder];
    const index = order.indexOf(group);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= order.length)
        return order;

    [order[index], order[target]] = [order[target], order[index]];
    return order;
}

export function normalizeConfig(config) {
    if (!config || typeof config !== 'object' || !Array.isArray(config.services))
        throw new Error('Configuration must contain a services array.');

    return {
        ...config,
        title: String(config.title || DEFAULT_CONFIG.title),
        subtitle: String(config.subtitle || DEFAULT_CONFIG.subtitle),
        eyebrow: String(config.eyebrow ?? DEFAULT_CONFIG.eyebrow),
        showEyebrow: config.showEyebrow !== false,
        showHeader: config.showHeader !== false,
        showTitle: config.showTitle !== false,
        showSearch: config.showSearch !== false,
        displayMode: normalizeDisplayMode(config.displayMode),
        groupOrder: normalizeGroupOrder(config.services, config.groupOrder),
        services: config.services,
        history: Array.isArray(config.history) ? config.history : [],
    };
}

export function newBookmarkId() {
    if (globalThis.crypto?.randomUUID)
        return globalThis.crypto.randomUUID();

    return `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function tagsArray(value) {
    const values = Array.isArray(value) ? value : String(value || '').split(',');
    const seen = new Set();

    return values
        .map(tag => String(tag).trim())
        .filter(tag => {
            const key = tag.toLowerCase();
            if (!tag || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
}

export function editableBookmark(service = EMPTY_BOOKMARK) {
    return {
        name: String(service.name || ''),
        url: String(service.url || ''),
        endpoints: formatEndpointDraft(service.endpoints),
        description: String(service.description || ''),
        group: String(service.group || ''),
        icon: String(service.icon || ''),
        accent: normalizeAccent(service.accent),
        tags: tagsArray(service.tags).join(', '),
        openMode: normalizeOpenMode(service.openMode),
        statusCheck: service.statusCheck !== false,
    };
}

export function storedBookmark(draft, original = {}) {
    const bookmark = {
        ...original,
        id: original.id || newBookmarkId(),
        name: String(draft.name || '').trim(),
        url: String(draft.url || '').trim(),
    };

    for (const field of ['description', 'group', 'icon']) {
        const value = String(draft[field] || '').trim();
        if (value)
            bookmark[field] = value;
        else
            delete bookmark[field];
    }

    const endpoints = normalizeEndpoints(parseEndpointDraft(draft.endpoints));
    if (endpoints.length)
        bookmark.endpoints = endpoints;
    else
        delete bookmark.endpoints;

    const accent = normalizeAccent(draft.accent);
    if (accent !== 'none')
        bookmark.accent = accent;
    else
        delete bookmark.accent;

    if (draft.statusCheck === false)
        bookmark.statusCheck = false;
    else
        delete bookmark.statusCheck;

    const tags = tagsArray(draft.tags);
    if (tags.length)
        bookmark.tags = tags;
    else
        delete bookmark.tags;

    const openMode = normalizeOpenMode(draft.openMode);
    if (openMode === 'same-tab')
        bookmark.openMode = openMode;
    else
        delete bookmark.openMode;

    return bookmark;
}

function comparableService(service) {
    return {
        name: String(service?.name || ''),
        url: String(service?.url || ''),
        endpoints: normalizeEndpoints(service?.endpoints),
        description: String(service?.description || ''),
        group: String(service?.group || ''),
        icon: String(service?.icon || ''),
        accent: normalizeAccent(service?.accent),
        tags: tagsArray(service?.tags).map(tag => tag.toLowerCase()).sort(),
        favorite: service?.favorite === true,
        openMode: normalizeOpenMode(service?.openMode),
        statusCheck: service?.statusCheck !== false,
    };
}

export function sameLegacyBookmark(left, right) {
    return JSON.stringify(comparableService(left)) === JSON.stringify(comparableService(right));
}

export function findBookmarkIndex(services, target) {
    if (target?.service?.id)
        return services.findIndex(service => service.id === target.service.id);

    if (Number.isInteger(target?.index) && target.index >= 0 && target.index < services.length &&
        sameLegacyBookmark(services[target.index], target.service))
        return target.index;

    return services.findIndex(service => sameLegacyBookmark(service, target?.service));
}

export function validateBookmark(draft, hostname) {
    const errors = {};
    const name = String(draft.name || '').trim();
    const url = String(draft.url || '').trim();

    if (!name)
        errors.name = 'Name is required.';

    if (!url)
        errors.url = 'URL is required.';
    else if (!allowedUrl(expandUrl(url, hostname)))
        errors.url = 'Use a complete http:// or https:// URL. The {host} placeholder is supported.';

    const endpoints = parseEndpointDraft(draft.endpoints);
    const invalidEndpoint = endpoints.findIndex(endpoint => !endpoint.url || !allowedUrl(expandUrl(endpoint.url, hostname)));
    if (invalidEndpoint !== -1)
        errors.endpoints = `Alternate address ${invalidEndpoint + 1} must use a complete http:// or https:// URL.`;

    return errors;
}

function isTargetService(service, index, target) {
    if (!target)
        return false;
    if (target.service?.id)
        return service.id === target.service.id;
    return target.index === index && sameLegacyBookmark(service, target.service);
}

export function duplicateWarnings(draft, services, target, hostname) {
    const warnings = [];
    const name = String(draft.name || '').trim().toLowerCase();
    const resolvedUrl = expandUrl(String(draft.url || '').trim(), hostname).toLowerCase();

    const duplicateName = name && services.some((service, index) =>
        !isTargetService(service, index, target) && String(service.name || '').trim().toLowerCase() === name);
    const duplicateUrl = resolvedUrl && services.some((service, index) =>
        !isTargetService(service, index, target) && expandUrl(service.url, hostname).trim().toLowerCase() === resolvedUrl);

    if (duplicateName)
        warnings.push('Another bookmark already uses this name.');
    if (duplicateUrl)
        warnings.push('Another bookmark already uses this URL.');

    return warnings;
}

export function duplicateBookmark(service, services = []) {
    const source = { ...service };
    delete source.sourceIndex;
    delete source.resolvedUrl;

    const baseName = String(source.name || 'Bookmark').trim() || 'Bookmark';
    const existingNames = new Set(services.map(item => String(item?.name || '').trim().toLowerCase()));
    let name = `${baseName} copy`;
    let counter = 2;
    while (existingNames.has(name.toLowerCase())) {
        name = `${baseName} copy ${counter}`;
        counter += 1;
    }

    return {
        ...source,
        id: newBookmarkId(),
        name,
    };
}

export function bookmarkWithFavorite(service, favorite) {
    const updated = { ...service };
    if (favorite)
        updated.favorite = true;
    else
        delete updated.favorite;
    return updated;
}

export function bookmarkWithGroup(service, group) {
    const updated = { ...service };
    const normalizedGroup = String(group || '').trim();
    if (normalizedGroup && normalizedGroup !== 'Ungrouped')
        updated.group = normalizedGroup;
    else
        delete updated.group;
    return updated;
}

export function moveService(services, fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 ||
        fromIndex >= services.length || toIndex >= services.length)
        return services;

    const result = [...services];
    const [moved] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, moved);
    return result;
}

function snapshotConfig(config) {
    return {
        title: config.title,
        subtitle: config.subtitle,
        eyebrow: config.eyebrow,
        showEyebrow: config.showEyebrow,
        showHeader: config.showHeader,
        showTitle: config.showTitle,
        showSearch: config.showSearch,
        displayMode: config.displayMode,
        groupOrder: [...config.groupOrder],
        services: JSON.parse(JSON.stringify(config.services)),
    };
}

export function withHistory(current, next, action) {
    const before = snapshotConfig(normalizeConfig(current));
    const normalizedNext = normalizeConfig(next);
    const after = snapshotConfig(normalizedNext);

    if (JSON.stringify(before) === JSON.stringify(after))
        return normalizedNext;

    const entry = {
        id: newBookmarkId(),
        savedAt: new Date().toISOString(),
        action: String(action || 'Configuration changed'),
        config: before,
    };

    return {
        ...normalizedNext,
        history: [...(Array.isArray(current.history) ? current.history : []), entry].slice(-HISTORY_LIMIT),
    };
}

export function restoreHistoryEntry(current, entry) {
    if (!entry?.config || !Array.isArray(entry.config.services))
        throw new Error('This history entry is invalid.');

    const services = JSON.parse(JSON.stringify(entry.config.services));
    return {
        ...normalizeConfig(current),
        ...entry.config,
        showEyebrow: entry.config.showEyebrow !== false,
        showHeader: entry.config.showHeader !== false,
        showTitle: entry.config.showTitle !== false,
        showSearch: entry.config.showSearch !== false,
        displayMode: normalizeDisplayMode(entry.config.displayMode),
        groupOrder: normalizeGroupOrder(services, entry.config.groupOrder),
        services,
        history: current.history,
    };
}

export function normalizeImportedConfig(value, hostname) {
    const config = normalizeConfig(value);

    const services = config.services.map((service, index) => {
        if (!service || typeof service !== 'object')
            throw new Error(`Bookmark ${index + 1} must be an object.`);

        const draft = editableBookmark(service);
        const errors = validateBookmark(draft, hostname);
        const firstError = Object.values(errors)[0];
        if (firstError)
            throw new Error(`Bookmark ${index + 1}: ${firstError}`);

        return storedBookmark(draft, service);
    });

    return {
        ...config,
        groupOrder: normalizeGroupOrder(services, config.groupOrder),
        services,
        history: Array.isArray(config.history) ? config.history.slice(-HISTORY_LIMIT) : [],
    };
}
