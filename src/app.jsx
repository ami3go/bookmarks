import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Page } from '@patternfly/react-core/dist/esm/components/Page/index.js';
import { SearchInput } from '@patternfly/react-core/dist/esm/components/SearchInput/index.js';

import {
    CONFIG_PATH,
    CONFIG_SYNTAX,
    DEFAULT_CONFIG,
    EDIT_MODE_TIMEOUT_MS,
    EMPTY_BOOKMARK,
    MAX_CONFIG_SIZE,
    allowedUrl,
    bookmarkWithFavorite,
    bookmarkWithGroup,
    duplicateBookmark,
    duplicateWarnings,
    editableBookmark,
    expandUrl,
    findBookmarkIndex,
    moveGroup,
    moveService,
    normalizeGroupOrder,
    normalizeImportedConfig,
    restoreHistoryEntry,
    serviceGroup,
    storedBookmark,
    validateBookmark,
} from './bookmarks.js';
import { BookmarkSections } from './bookmark-sections.jsx';
import {
    COLLAPSED_GROUPS_KEY,
    FAVORITES_SECTION_KEY,
    loadCollapsedGroups,
    runtimeFreeService,
    serviceSelectionKey,
    typingTarget,
} from './bookmark-ui.js';
import { modifyConfiguration, watchConfiguration } from './cockpit-config.js';
import { ManagementDialogs } from './management-dialogs.jsx';
import { ServiceDiscovery } from './service-discovery.jsx';

function PencilIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a.996.996 0 0 0 0-1.41l-2.5-2.5a.996.996 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-1.8Z" />
        </svg>
    );
}

export const Application = () => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [query, setQuery] = useState('');
    const [groupFilter, setGroupFilter] = useState('all');
    const [notice, setNotice] = useState(null);
    const [canEdit, setCanEdit] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [selectedBookmark, setSelectedBookmark] = useState(null);
    const [editor, setEditor] = useState(null);
    const [draft, setDraft] = useState(EMPTY_BOOKMARK);
    const [formErrors, setFormErrors] = useState({});
    const [writeErrors, setWriteErrors] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [moveTarget, setMoveTarget] = useState(null);
    const [moveGroupDraft, setMoveGroupDraft] = useState('Ungrouped');
    const [saving, setSaving] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsDraft, setSettingsDraft] = useState({
        title: DEFAULT_CONFIG.title,
        subtitle: DEFAULT_CONFIG.subtitle,
        eyebrow: DEFAULT_CONFIG.eyebrow,
        showEyebrow: true,
        displayMode: DEFAULT_CONFIG.displayMode,
    });
    const [settingsError, setSettingsError] = useState('');
    const [importCandidate, setImportCandidate] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [dragSource, setDragSource] = useState(null);
    const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
    const fileInputRef = useRef(null);

    const hostname = window.location.hostname;

    useEffect(() => watchConfiguration(
        setConfig,
        error => setNotice({
            variant: 'danger',
            text: `Could not monitor ${CONFIG_PATH}: ${window.cockpit.message(error)}`,
        }),
        () => setNotice({
            variant: 'info',
            text: `No configuration found. Add your first bookmark to create ${CONFIG_PATH}.`,
        })
    ), []);

    useEffect(() => {
        const permission = window.cockpit.permission({ admin: true });
        const updatePermission = () => {
            setCanEdit(permission.allowed);
            if (!permission.allowed)
                setEditMode(false);
        };

        updatePermission();
        permission.addEventListener('changed', updatePermission);

        return () => {
            permission.removeEventListener('changed', updatePermission);
            permission.close();
        };
    }, []);

    useEffect(() => {
        if (!editMode) {
            setSelectedBookmark(null);
            setDragSource(null);
        }
    }, [editMode]);

    useEffect(() => {
        if (!editMode || editor || deleteTarget || moveTarget || settingsOpen || importCandidate || historyOpen)
            return undefined;

        let timer;
        const resetTimer = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setEditMode(false), EDIT_MODE_TIMEOUT_MS);
        };

        resetTimer();
        window.addEventListener('pointerdown', resetTimer);
        window.addEventListener('keydown', resetTimer);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('pointerdown', resetTimer);
            window.removeEventListener('keydown', resetTimer);
        };
    }, [editMode, editor, deleteTarget, moveTarget, settingsOpen, importCandidate, historyOpen]);

    useEffect(() => {
        try {
            window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups]));
        } catch (_) {
            // Local storage is an optional convenience; the dashboard still works without it.
        }
    }, [collapsedGroups]);

    useEffect(() => {
        const managementOpen = Boolean(editor || deleteTarget || moveTarget || settingsOpen || importCandidate || historyOpen);
        const handleKeyboard = event => {
            if (managementOpen)
                return;

            const isTyping = typingTarget(event.target);
            if (event.key === '/' && !isTyping) {
                const search = document.querySelector('.bookmarks-search input');
                if (search) {
                    event.preventDefault();
                    search.focus();
                    search.select?.();
                }
                return;
            }

            if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
                document.querySelector('.bookmarks-search input')?.focus();
                return;
            }

            if (isTyping || !['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key))
                return;

            const cards = [...document.querySelectorAll('.bookmark-card')]
                .filter(card => card instanceof HTMLElement && card.offsetParent !== null);
            if (cards.length === 0)
                return;

            const active = document.activeElement;
            const activeIndex = cards.indexOf(active);
            const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
            if (activeIndex === -1 && active !== document.body && !active?.matches?.('.bookmarks-page'))
                return;

            event.preventDefault();
            const nextIndex = activeIndex === -1
                ? (forward ? 0 : cards.length - 1)
                : (activeIndex + (forward ? 1 : -1) + cards.length) % cards.length;
            cards[nextIndex].focus();
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [query, editor, deleteTarget, moveTarget, settingsOpen, importCandidate, historyOpen]);

    const groups = useMemo(
        () => normalizeGroupOrder(config.services, config.groupOrder),
        [config.services, config.groupOrder]
    );
    const hasFavorites = useMemo(
        () => config.services.some(service => service?.favorite === true),
        [config.services]
    );

    useEffect(() => {
        if (groupFilter !== 'all' && !groups.includes(groupFilter))
            setGroupFilter('all');
    }, [groupFilter, groups]);

    useEffect(() => {
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
    }, [groups, hasFavorites]);

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

    const currentTarget = editor?.mode === 'edit' ? editor.target : null;
    const warnings = useMemo(
        () => duplicateWarnings(draft, config.services, currentTarget, hostname),
        [draft, config.services, currentTarget, hostname]
    );
    const resolvedPreview = draft.url.trim() ? expandUrl(draft.url.trim(), hostname) : '';
    const compactMode = config.displayMode === 'compact';

    const clearWriteError = area => {
        if (!area)
            return;
        setWriteErrors(current => {
            if (!current[area])
                return current;
            const next = { ...current };
            delete next[area];
            return next;
        });
    };

    const modifyConfig = (transform, successText, onSuccess, action = successText, errorArea = null) => {
        clearWriteError(errorArea);
        setSaving(true);
        setNotice(null);

        modifyConfiguration(transform, action)
            .then(newConfig => {
                setSaving(false);
                setConfig(newConfig);
                setNotice({ variant: 'success', text: successText });
                onSuccess?.();
            })
            .catch(error => {
                setSaving(false);
                const text = `Could not update ${CONFIG_PATH}: ${window.cockpit.message(error)}`;
                setNotice({ variant: 'danger', text });
                if (errorArea)
                    setWriteErrors(current => ({ ...current, [errorArea]: text }));
            });
    };

    const openAdd = () => {
        if (canEdit !== true)
            return;
        clearWriteError('editor');
        setDraft({ ...EMPTY_BOOKMARK });
        setFormErrors({});
        setEditor({ mode: 'add' });
    };

    const openEdit = service => {
        if (!editMode || canEdit !== true)
            return;

        clearWriteError('editor');
        setSelectedBookmark(serviceSelectionKey(service));
        const storedService = runtimeFreeService(service);
        setDraft(editableBookmark(storedService));
        setFormErrors({});
        setEditor({
            mode: 'edit',
            target: { index: service.sourceIndex, service: storedService },
        });
    };

    const closeEditor = () => {
        if (!saving) {
            setEditor(null);
            setFormErrors({});
        }
    };

    const updateDraft = (field, value) => {
        clearWriteError('editor');
        setDraft(current => ({ ...current, [field]: value }));
        setFormErrors(current => ({ ...current, [field]: undefined }));
    };

    const submitEditor = event => {
        event.preventDefault();
        const errors = validateBookmark(draft, hostname);
        setFormErrors(errors);
        if (Object.keys(errors).length > 0)
            return;

        if (editor.mode === 'add') {
            modifyConfig(current => ({
                ...current,
                services: [...current.services, storedBookmark(draft)],
            }), 'Bookmark added.', () => setEditor(null), `Added ${draft.name.trim()}`, 'editor');
            return;
        }

        if (!editMode)
            return;

        modifyConfig(current => {
            const index = findBookmarkIndex(current.services, editor.target);
            if (index === -1)
                throw new Error('This bookmark was changed or removed. Reload the page and try again.');

            const updatedServices = [...current.services];
            updatedServices[index] = storedBookmark(draft, updatedServices[index]);
            return { ...current, services: updatedServices };
        }, 'Bookmark updated.', () => {
            setEditor(null);
            setSelectedBookmark(null);
        }, `Edited ${draft.name.trim()}`, 'editor');
    };

    const requestDelete = service => {
        if (!editMode || canEdit !== true)
            return;

        clearWriteError('delete');
        setSelectedBookmark(serviceSelectionKey(service));
        setDeleteTarget({ index: service.sourceIndex, service: runtimeFreeService(service) });
    };

    const deleteBookmark = () => {
        modifyConfig(current => {
            const index = findBookmarkIndex(current.services, deleteTarget);
            if (index === -1)
                throw new Error('This bookmark was changed or removed. Reload the page and try again.');

            return {
                ...current,
                services: current.services.filter((_, serviceIndex) => serviceIndex !== index),
            };
        }, 'Bookmark deleted.', () => {
            setDeleteTarget(null);
            setSelectedBookmark(null);
        }, `Deleted ${deleteTarget?.service?.name || 'bookmark'}`, 'delete');
    };

    const openMoveToGroup = service => {
        if (!editMode || canEdit !== true)
            return;
        clearWriteError('move');
        setSelectedBookmark(serviceSelectionKey(service));
        setMoveTarget({ index: service.sourceIndex, service: runtimeFreeService(service) });
        setMoveGroupDraft(serviceGroup(service));
    };

    const moveBookmarkToGroup = () => {
        if (!moveTarget || !editMode)
            return;

        const destination = moveGroupDraft || 'Ungrouped';
        modifyConfig(current => {
            const index = findBookmarkIndex(current.services, moveTarget);
            if (index === -1)
                throw new Error('This bookmark was changed or removed. Reload the page and try again.');
            const updatedServices = [...current.services];
            updatedServices[index] = bookmarkWithGroup(updatedServices[index], destination);
            return { ...current, services: updatedServices };
        }, `Bookmark moved to ${destination}.`, () => {
            setMoveTarget(null);
            setSelectedBookmark(null);
        }, `Moved ${moveTarget.service.name || 'bookmark'} to ${destination}`, 'move');
    };

    const toggleFavorite = service => {
        if (!editMode || canEdit !== true)
            return;

        const target = { index: service.sourceIndex, service: runtimeFreeService(service) };
        const nextFavorite = service.favorite !== true;
        modifyConfig(current => {
            const index = findBookmarkIndex(current.services, target);
            if (index === -1)
                throw new Error('This bookmark was changed or removed. Reload the page and try again.');
            const updatedServices = [...current.services];
            updatedServices[index] = bookmarkWithFavorite(updatedServices[index], nextFavorite);
            return { ...current, services: updatedServices };
        }, nextFavorite ? 'Bookmark added to Favorites.' : 'Bookmark removed from Favorites.', undefined,
        `${nextFavorite ? 'Favorited' : 'Unfavorited'} ${service.name || 'bookmark'}`);
    };

    const duplicateService = service => {
        if (!editMode || canEdit !== true)
            return;

        const target = { index: service.sourceIndex, service: runtimeFreeService(service) };
        modifyConfig(current => {
            const index = findBookmarkIndex(current.services, target);
            if (index === -1)
                throw new Error('This bookmark was changed or removed. Reload the page and try again.');
            const duplicate = duplicateBookmark(current.services[index], current.services);
            const updatedServices = [...current.services];
            updatedServices.splice(index + 1, 0, duplicate);
            return { ...current, services: updatedServices };
        }, 'Bookmark duplicated.', undefined, `Duplicated ${service.name || 'bookmark'}`);
    };

    const openService = service => {
        if (service.openMode === 'same-tab')
            window.open(service.resolvedUrl, '_top');
        else
            window.open(service.resolvedUrl, '_blank', 'noopener,noreferrer');
    };

    const selectService = service => {
        if (editMode && canEdit === true)
            setSelectedBookmark(serviceSelectionKey(service));
    };

    const reorderBetween = (source, target) => {
        if (!editMode || !source || !target || source.sourceIndex === target.sourceIndex)
            return;
        if (serviceGroup(source) !== serviceGroup(target)) {
            setNotice({ variant: 'warning', text: 'Drag-and-drop reordering is limited to bookmarks in the same group.' });
            return;
        }

        const sourceStored = runtimeFreeService(source);
        const targetStored = runtimeFreeService(target);
        modifyConfig(current => {
            const fromIndex = findBookmarkIndex(current.services, { index: source.sourceIndex, service: sourceStored });
            const toIndex = findBookmarkIndex(current.services, { index: target.sourceIndex, service: targetStored });
            if (fromIndex === -1 || toIndex === -1)
                throw new Error('A bookmark changed while reordering. Reload and try again.');
            return { ...current, services: moveService(current.services, fromIndex, toIndex) };
        }, 'Bookmark order updated.', undefined, 'Reordered bookmarks');
    };

    const moveWithinGroup = (service, direction) => {
        const siblingIndexes = config.services
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => serviceGroup(item) === serviceGroup(service))
            .map(({ index }) => index);
        const position = siblingIndexes.indexOf(service.sourceIndex);
        const targetPosition = position + direction;
        if (position === -1 || targetPosition < 0 || targetPosition >= siblingIndexes.length)
            return;

        setSelectedBookmark(serviceSelectionKey(service));
        const targetIndex = siblingIndexes[targetPosition];
        reorderBetween(service, {
            ...config.services[targetIndex],
            sourceIndex: targetIndex,
            resolvedUrl: expandUrl(config.services[targetIndex].url, hostname),
        });
    };

    const moveGroupWithinOrder = (group, direction) => {
        const position = groups.indexOf(group);
        const targetPosition = position + direction;
        if (position === -1 || targetPosition < 0 || targetPosition >= groups.length)
            return;

        modifyConfig(current => {
            const currentOrder = normalizeGroupOrder(current.services, current.groupOrder);
            return { ...current, groupOrder: moveGroup(currentOrder, group, direction) };
        }, 'Group order updated.', undefined, `Moved ${group} group ${direction < 0 ? 'up' : 'down'}`);
    };

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

    const toggleEditMode = () => {
        if (canEdit !== true || saving)
            return;
        setEditMode(current => !current);
    };

    const openSettings = () => {
        if (!editMode)
            return;
        clearWriteError('settings');
        setSettingsDraft({
            title: config.title,
            subtitle: config.subtitle,
            eyebrow: config.eyebrow,
            showEyebrow: config.showEyebrow,
            displayMode: config.displayMode,
        });
        setSettingsError('');
        setSettingsOpen(true);
    };

    const submitSettings = event => {
        event.preventDefault();
        if (!settingsDraft.title.trim()) {
            setSettingsError('Title is required.');
            return;
        }

        modifyConfig(current => ({
            ...current,
            title: settingsDraft.title.trim(),
            subtitle: settingsDraft.subtitle.trim(),
            eyebrow: settingsDraft.eyebrow.trim(),
            showEyebrow: settingsDraft.showEyebrow,
            displayMode: settingsDraft.displayMode,
        }), 'Page settings updated.', () => setSettingsOpen(false), 'Updated page settings', 'settings');
    };

    const exportConfig = () => {
        const blob = new Blob([CONFIG_SYNTAX.stringify(config)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cockpit-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleImportFile = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;

        if (file.size > MAX_CONFIG_SIZE) {
            setNotice({ variant: 'danger', text: 'Import file is too large.' });
            return;
        }

        try {
            const parsed = JSON.parse(await file.text());
            clearWriteError('import');
            setImportCandidate(normalizeImportedConfig(parsed, hostname));
        } catch (error) {
            setNotice({ variant: 'danger', text: `Could not import JSON: ${error.message}` });
        }
    };

    const confirmImport = () => {
        if (!importCandidate || !editMode)
            return;

        modifyConfig(current => ({
            ...importCandidate,
            history: current.history,
        }), `Imported ${importCandidate.services.length} bookmarks.`, () => {
            setImportCandidate(null);
            setQuery('');
            setGroupFilter('all');
            setSelectedBookmark(null);
        }, 'Imported configuration', 'import');
    };

    const openHistory = () => {
        clearWriteError('history');
        setHistoryOpen(true);
    };

    const restoreHistory = entry => {
        if (!editMode)
            return;
        modifyConfig(current => restoreHistoryEntry(current, entry), 'Configuration restored.', () => {
            setHistoryOpen(false);
            setSelectedBookmark(null);
        }, 'Restored history snapshot', 'history');
    };

    const clearFilters = () => {
        setQuery('');
        setGroupFilter('all');
    };

    return (
        <Page className="pf-m-no-sidebar">
            <main className="bookmarks-page">
                <header className="bookmarks-header">
                    <div className="bookmarks-heading">
                        {config.showEyebrow && config.eyebrow && <p className="bookmarks-eyebrow">{config.eyebrow}</p>}
                        <h1>{config.title}</h1>
                        {config.subtitle && <p className="bookmarks-subtitle">{config.subtitle}</p>}
                    </div>
                    <div className="bookmarks-header-actions">
                        <div className="bookmarks-search">
                            <SearchInput
                                aria-label="Search bookmarks"
                                placeholder="Search bookmarks…"
                                value={query}
                                onChange={(_event, value) => setQuery(value)}
                                onClear={() => setQuery('')}
                            />
                        </div>
                        <label className="bookmarks-group-filter">
                            <span className="sr-only">Filter by group</span>
                            <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}>
                                <option value="all">All groups</option>
                                {groups.map(group => <option value={group} key={group}>{group}</option>)}
                            </select>
                        </label>
                        <Button variant="primary" onClick={openAdd} isDisabled={canEdit !== true}>
                            Add bookmark
                        </Button>
                        <Button
                            variant={editMode ? 'secondary' : 'plain'}
                            className="bookmark-edit-mode-toggle"
                            onClick={toggleEditMode}
                            isDisabled={canEdit !== true}
                            aria-label={editMode ? 'Disable edit mode' : 'Enable edit mode'}
                            aria-pressed={editMode}
                            title={editMode ? 'Disable edit mode' : 'Enable edit mode'}
                        >
                            <PencilIcon />
                        </Button>
                    </div>
                </header>

                {canEdit === false && (
                    <Alert isInline variant="info" title="Read-only mode" className="bookmarks-notice">
                        Administrator privileges are required to add, edit, delete, reorder, or import bookmarks.
                    </Alert>
                )}

                {editMode && canEdit === true && (
                    <div className="bookmarks-management-bar">
                        <div>
                            <strong>Edit mode enabled.</strong>
                            <span> Click a card to select it, or drag a card to reorder. Edit mode locks automatically after 2 minutes of inactivity.</span>
                        </div>
                        <div className="bookmarks-management-actions">
                            <Button variant="secondary" onClick={openSettings}>Page settings</Button>
                            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import JSON</Button>
                            <Button variant="secondary" onClick={exportConfig}>Export JSON</Button>
                            <Button variant="secondary" onClick={openHistory}>
                                History ({config.history.length})
                            </Button>
                        </div>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    className="bookmarks-file-input"
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportFile}
                />

                {notice && (
                    <Alert isInline variant={notice.variant} title={notice.text} className="bookmarks-notice" />
                )}

                {config.services.length === 0 ? (
                    <div className="bookmarks-empty bookmarks-empty-first-run">
                        <h2>Add your first service</h2>
                        <p>
                            Bookmarks are stored in <code>{CONFIG_PATH}</code>. Use <code>{'{host}'}</code> in a URL to reuse
                            the hostname or IP address that opened Cockpit.
                        </p>
                        {canEdit === true && <Button variant="primary" onClick={openAdd}>Add your first bookmark</Button>}
                    </div>
                ) : services.length === 0 ? (
                    <div className="bookmarks-empty">
                        <h2>No matching bookmarks</h2>
                        <p>Change the search text or group filter to show more services.</p>
                        <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
                    </div>
                ) : (
                    <BookmarkSections
                        sections={sections}
                        collapsedGroups={collapsedGroups}
                        query={query}
                        editMode={editMode}
                        canEdit={canEdit}
                        groups={groups}
                        saving={saving}
                        configServices={config.services}
                        selectedBookmark={selectedBookmark}
                        dragSource={dragSource}
                        compactMode={compactMode}
                        onToggleGroupCollapsed={toggleGroupCollapsed}
                        onMoveGroupWithinOrder={moveGroupWithinOrder}
                        onSelectService={selectService}
                        onOpenService={openService}
                        onSetSelectedBookmark={setSelectedBookmark}
                        onSetDragSource={setDragSource}
                        onReorderBetween={reorderBetween}
                        onOpenEdit={openEdit}
                        onToggleFavorite={toggleFavorite}
                        onDuplicateService={duplicateService}
                        onOpenMoveToGroup={openMoveToGroup}
                        onMoveWithinGroup={moveWithinGroup}
                        onRequestDelete={requestDelete}
                    />
                )}

                <footer className="bookmarks-footer">
                    Configuration: <code>{CONFIG_PATH}</code>
                </footer>
            </main>

            <ManagementDialogs
                editor={editor}
                closeEditor={closeEditor}
                writeErrors={writeErrors}
                submitEditor={submitEditor}
                warnings={warnings}
                draft={draft}
                updateDraft={updateDraft}
                formErrors={formErrors}
                resolvedPreview={resolvedPreview}
                groups={groups}
                saving={saving}
                moveTarget={moveTarget}
                setMoveTarget={setMoveTarget}
                moveGroupDraft={moveGroupDraft}
                setMoveGroupDraft={setMoveGroupDraft}
                clearWriteError={clearWriteError}
                moveBookmarkToGroup={moveBookmarkToGroup}
                editMode={editMode}
                deleteTarget={deleteTarget}
                setDeleteTarget={setDeleteTarget}
                deleteBookmark={deleteBookmark}
                settingsOpen={settingsOpen}
                setSettingsOpen={setSettingsOpen}
                settingsDraft={settingsDraft}
                setSettingsDraft={setSettingsDraft}
                settingsError={settingsError}
                setSettingsError={setSettingsError}
                submitSettings={submitSettings}
                importCandidate={importCandidate}
                setImportCandidate={setImportCandidate}
                confirmImport={confirmImport}
                historyOpen={historyOpen}
                setHistoryOpen={setHistoryOpen}
                config={config}
                restoreHistory={restoreHistory}
            />

            <ServiceDiscovery visible={editMode && canEdit === true} />
        </Page>
    );
};
