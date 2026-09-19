import { useEffect, useMemo, useState } from 'react';

import {
    allowedUrl,
    expandUrl,
    normalizeGroupOrder,
    serviceGroup,
} from './bookmarks.js';
import {
    COLLAPSED_GROUPS_KEY,
    FAVORITES_SECTION_KEY,
    loadCollapsedGroups,
} from './bookmark-ui.js';

export function useDashboardView(config, loaded = true) {
    const [query, setQuery] = useState('');
    const [groupFilter, setGroupFilter] = useState('all');
    const [dragSource, setDragSource] = useState(null);
    const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
    const hostname = window.location.hostname;

    const groups = useMemo(
        () => normalizeGroupOrder(config.services, config.groupOrder),
        [config.services, config.groupOrder]
    );
    const hasFavorites = useMemo(
        () => config.services.some(service => service?.favorite === true),
        [config.services]
    );

    useEffect(() => {
        if (!config.showSearch && query)
            setQuery('');
    }, [config.showSearch, query]);

    useEffect(() => {
        if (groupFilter !== 'all' && !groups.includes(groupFilter))
            setGroupFilter('all');
    }, [groupFilter, groups]);

    useEffect(() => {
        if (!loaded)
            return;
        setCollapsedGroups(current => {
            const available = new Set([
                ...(hasFavorites ? [FAVORITES_SECTION_KEY] : []),
                ...groups.map(group => `group:${group}`),
            ]);
            const next = new Set([...current].filter(group => available.has(group)));
            if (next.size === current.size && [...next].every(group => current.has(group)))
                return current;
            return next;
        });
    }, [groups, hasFavorites, loaded]);

    useEffect(() => {
        if (!loaded)
            return;
        try {
            window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups]));
        } catch (_) {
            // Local storage is an optional convenience; the dashboard still works without it.
        }
    }, [collapsedGroups, loaded]);

    const services = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return config.services
            .map((service, index) => ({
                ...service,
                sourceIndex: index,
                resolvedUrl: expandUrl(service.url, hostname),
            }))
            .filter(service => allowedUrl(service.resolvedUrl))
            .filter(service => groupFilter === 'all' || serviceGroup(service) === groupFilter)
            .filter(service => {
                if (!needle)
                    return true;
                const tags = Array.isArray(service.tags) ? service.tags.join(' ') : String(service.tags || '');
                const haystack = `${service.name || ''} ${service.description || ''} ${service.group || ''} ${service.url || ''} ${tags}`.toLowerCase();
                return haystack.includes(needle);
            });
    }, [config.services, query, groupFilter, hostname]);

    const groupedServices = useMemo(() => {
        const result = new Map();
        for (const service of services) {
            const group = serviceGroup(service);
            if (!result.has(group))
                result.set(group, []);
            result.get(group).push(service);
        }
        return groups
            .filter(group => result.has(group))
            .map(group => [group, result.get(group)]);
    }, [services, groups]);

    const favoriteServices = useMemo(
        () => services.filter(service => service.favorite === true),
        [services]
    );

    const sections = useMemo(() => {
        const normalSections = groupedServices.map(([name, items]) => ({
            sectionKey: `group:${name}`,
            collapseKey: `group:${name}`,
            name,
            items,
            isFavorites: false,
        }));
        if (groupFilter === 'all' && favoriteServices.length > 0) {
            return [{
                sectionKey: FAVORITES_SECTION_KEY,
                collapseKey: FAVORITES_SECTION_KEY,
                name: 'Favorites',
                items: favoriteServices,
                isFavorites: true,
            }, ...normalSections];
        }
        return normalSections;
    }, [favoriteServices, groupedServices, groupFilter]);

    const toggleGroupCollapsed = group => {
        setCollapsedGroups(current => {
            const next = new Set(current);
            if (next.has(group))
                next.delete(group);
            else
                next.add(group);
            return next;
        });
    };

    const clearFilters = () => {
        setQuery('');
        setGroupFilter('all');
    };

    return {
        hostname,
        query,
        setQuery,
        groupFilter,
        setGroupFilter,
        dragSource,
        setDragSource,
        collapsedGroups,
        groups,
        services,
        sections,
        compactMode: config.displayMode === 'compact',
        toggleGroupCollapsed,
        clearFilters,
    };
}
