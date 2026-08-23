export const COLLAPSED_GROUPS_KEY = 'cockpit-bookmarks:collapsed-groups';
export const FAVORITES_SECTION_KEY = 'favorites:pinned';

export function runtimeFreeService(service) {
    const { sourceIndex, resolvedUrl, ...storedService } = service;
    return storedService;
}

export function serviceSelectionKey(service) {
    if (service.id)
        return `id:${service.id}`;

    const tags = Array.isArray(service.tags) ? service.tags.join('\u001f') : String(service.tags || '');
    return `legacy:${service.name || ''}\u001f${service.url || ''}\u001f${service.description || ''}\u001f${service.group || ''}\u001f${service.icon || ''}\u001f${tags}`;
}

export function formatHistoryDate(value) {
    try {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value || 'Unknown time') : date.toLocaleString();
    } catch (_) {
        return String(value || 'Unknown time');
    }
}

export function closeActionMenu(event) {
    event.currentTarget.closest('details')?.removeAttribute('open');
}

export function loadCollapsedGroups() {
    try {
        const stored = JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_KEY) || '[]');
        return new Set(Array.isArray(stored) ? stored.map(value => String(value)) : []);
    } catch (_) {
        return new Set();
    }
}

export function typingTarget(target) {
    return target instanceof HTMLElement &&
        (target.matches('input, textarea, select') || target.isContentEditable);
}
