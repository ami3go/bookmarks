import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { Page } from '@patternfly/react-core/dist/esm/components/Page/index.js';
import { SearchInput } from '@patternfly/react-core/dist/esm/components/SearchInput/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import {
    CONFIG_PATH,
    CONFIG_SYNTAX,
    DEFAULT_CONFIG,
    DISPLAY_MODES,
    EDIT_MODE_TIMEOUT_MS,
    EMPTY_BOOKMARK,
    ICON_PRESETS,
    MAX_CONFIG_SIZE,
    allowedUrl,
    duplicateWarnings,
    editableBookmark,
    expandUrl,
    findBookmarkIndex,
    moveGroup,
    moveService,
    normalizeConfig,
    normalizeGroupOrder,
    normalizeImportedConfig,
    restoreHistoryEntry,
    serviceGroup,
    storedBookmark,
    validateBookmark,
    withHistory,
} from './bookmarks.js';

const COLLAPSED_GROUPS_KEY = 'cockpit-bookmarks:collapsed-groups';

function PencilIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a.996.996 0 0 0 0-1.41l-2.5-2.5a.996.996 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-1.8Z" />
        </svg>
    );
}

function runtimeFreeService(service) {
    const { sourceIndex, resolvedUrl, ...storedService } = service;
    return storedService;
}

function serviceSelectionKey(service) {
    if (service.id)
        return `id:${service.id}`;

    const tags = Array.isArray(service.tags) ? service.tags.join('\u001f') : String(service.tags || '');
    return `legacy:${service.name || ''}\u001f${service.url || ''}\u001f${service.description || ''}\u001f${service.group || ''}\u001f${service.icon || ''}\u001f${tags}`;
}

function formatHistoryDate(value) {
    try {
        return new Date(value).toLocaleString();
    } catch (_) {
        return String(value || 'Unknown time');
    }
}

function closeActionMenu(event) {
    event.currentTarget.closest('details')?.removeAttribute('open');
}

function loadCollapsedGroups() {
    try {
        const stored = JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_KEY) || '[]');
        return new Set(Array.isArray(stored) ? stored.map(value => String(value)) : []);
    } catch (_) {
        return new Set();
    }
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
    const [deleteTarget, setDeleteTarget] = useState(null);
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

    useEffect(() => {
        const file = window.cockpit.file(CONFIG_PATH, { syntax: CONFIG_SYNTAX, max_read_size: MAX_CONFIG_SIZE });
        let active = true;

        file.read()
            .then(content => {
                if (!active)
                    return;

                if (content === null) {
                    setNotice({
                        variant: 'info',
                        text: `No configuration found. Add your first bookmark to create ${CONFIG_PATH}.`,
                    });
                    return;
                }

                setConfig(normalizeConfig(content));
            })
            .catch(error => {
                if (!active)
                    return;
                setNotice({
                    variant: 'danger',
                    text: `Could not load ${CONFIG_PATH}: ${window.cockpit.message(error)}`,
                });
            });

        return () => {
            active = false;
            file.close();
        };
    }, []);

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
        if (!editMode || editor || deleteTarget || settingsOpen || importCandidate || historyOpen)
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
    }, [editMode, editor, deleteTarget, settingsOpen, importCandidate, historyOpen]);

    useEffect(() => {
        try {
            window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...collapsedGroups]));
        } catch (_) {
            // Local storage is an optional convenience; the dashboard still works without it.
        }
    }, [collapsedGroups]);

    const groups = useMemo(
        () => normalizeGroupOrder(config.services, config.groupOrder),
        [config.services, config.groupOrder]
    );

    useEffect(() => {
        if (groupFilter !== 'all' && !groups.includes(groupFilter))
            setGroupFilter('all');
    }, [groupFilter, groups]);

    useEffect(() => {
        setCollapsedGroups(current => {
            const available = new Set(groups);
            const next = new Set([...current].filter(group => available.has(group)));
            if (next.size === current.size && [...next].every(group => current.has(group)))
                return current;
            return next;
        });
    }, [groups]);

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

    const currentTarget = editor?.mode === 'edit' ? editor.target : null;
    const warnings = useMemo(
        () => duplicateWarnings(draft, config.services, currentTarget, hostname),
        [draft, config.services, currentTarget, hostname]
    );
    const resolvedPreview = draft.url.trim() ? expandUrl(draft.url.trim(), hostname) : '';
    const compactMode = config.displayMode === 'compact';

    const modifyConfig = (transform, successText, onSuccess, action = successText) => {
        const file = window.cockpit.file(CONFIG_PATH, {
            syntax: CONFIG_SYNTAX,
            max_read_size: MAX_CONFIG_SIZE,
            superuser: 'require',
        });

        setSaving(true);
        setNotice(null);

        file.modify(oldContent => {
            const current = oldContent === null
                ? { ...DEFAULT_CONFIG, services: [], history: [] }
                : normalizeConfig(oldContent);
            const next = transform(current);
            return withHistory(current, next, action);
        })
            .then(newContent => {
                file.close();
                setSaving(false);
                setConfig(normalizeConfig(newContent));
                setNotice({ variant: 'success', text: successText });
                onSuccess?.();
            })
            .catch(error => {
                file.close();
                setSaving(false);
                setNotice({
                    variant: 'danger',
                    text: `Could not update ${CONFIG_PATH}: ${window.cockpit.message(error)}`,
                });
            });
    };

    const openAdd = () => {
        if (canEdit !== true)
            return;
        setDraft({ ...EMPTY_BOOKMARK });
        setFormErrors({});
        setEditor({ mode: 'add' });
    };

    const openEdit = service => {
        if (!editMode || canEdit !== true)
            return;

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
            }), 'Bookmark added.', () => setEditor(null), `Added ${draft.name.trim()}`);
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
        }, `Edited ${draft.name.trim()}`);
    };

    const requestDelete = service => {
        if (!editMode || canEdit !== true)
            return;

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
        }, `Deleted ${deleteTarget?.service?.name || 'bookmark'}`);
    };

    const openService = service => {
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
        }), 'Page settings updated.', () => setSettingsOpen(false), 'Updated page settings');
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
        }, 'Imported configuration');
    };

    const restoreHistory = entry => {
        if (!editMode)
            return;
        modifyConfig(current => restoreHistoryEntry(current, entry), 'Configuration restored.', () => {
            setHistoryOpen(false);
            setSelectedBookmark(null);
        }, 'Restored history snapshot');
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
                        <SearchInput
                            aria-label="Search bookmarks"
                            placeholder="Search bookmarks…"
                            value={query}
                            onChange={(_event, value) => setQuery(value)}
                            onClear={() => setQuery('')}
                        />
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
                            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
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
                    <div className="bookmark-groups">
                        {groupedServices.map(([group, groupServices]) => {
                            const isCollapsed = collapsedGroups.has(group) && !query.trim();
                            return (
                                <section className="bookmark-group-section" key={group} aria-labelledby={`group-${group.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
                                    <div className="bookmark-group-heading">
                                        <Button
                                            variant="plain"
                                            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group} group`}
                                            aria-expanded={!isCollapsed}
                                            title={isCollapsed ? 'Expand group' : 'Collapse group'}
                                            onClick={() => toggleGroupCollapsed(group)}
                                        >
                                            <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                                        </Button>
                                        <h2 id={`group-${group.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>{group}</h2>
                                        <span>{groupServices.length}</span>
                                        {editMode && canEdit === true && groups.length > 1 && (
                                            <div
                                                style={{ display: 'flex', gap: '0.15rem', marginLeft: 'auto' }}
                                                onClick={event => event.stopPropagation()}
                                                onKeyDown={event => event.stopPropagation()}
                                            >
                                                <Button
                                                    variant="plain"
                                                    aria-label={`Move ${group} group up`}
                                                    title="Move group up"
                                                    isDisabled={groups[0] === group || saving}
                                                    onClick={() => moveGroupWithinOrder(group, -1)}
                                                >
                                                    ↑
                                                </Button>
                                                <Button
                                                    variant="plain"
                                                    aria-label={`Move ${group} group down`}
                                                    title="Move group down"
                                                    isDisabled={groups[groups.length - 1] === group || saving}
                                                    onClick={() => moveGroupWithinOrder(group, 1)}
                                                >
                                                    ↓
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {!isCollapsed && (
                                        <div
                                            className="bookmarks-grid"
                                            style={compactMode ? {
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))',
                                                gap: '0.65rem',
                                            } : undefined}
                                        >
                                            {groupServices.map(service => {
                                                const siblingIndexes = config.services
                                                    .map((item, index) => ({ item, index }))
                                                    .filter(({ item }) => serviceGroup(item) === serviceGroup(service))
                                                    .map(({ index }) => index);
                                                const groupPosition = siblingIndexes.indexOf(service.sourceIndex);
                                                const canMoveUp = groupPosition > 0;
                                                const canMoveDown = groupPosition >= 0 && groupPosition < siblingIndexes.length - 1;
                                                const selectionKey = serviceSelectionKey(service);
                                                const isSelected = editMode && selectedBookmark === selectionKey;
                                                const isDragging = dragSource?.sourceIndex === service.sourceIndex;

                                                return (
                                                    <Card
                                                        className={`bookmark-card${editMode ? ' is-editable' : ''}${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
                                                        key={service.id || `${service.sourceIndex}-${service.resolvedUrl}`}
                                                        role={editMode ? 'button' : 'link'}
                                                        tabIndex={0}
                                                        draggable={editMode && canEdit === true && !saving}
                                                        aria-label={editMode
                                                            ? `Select ${service.name || 'service'} for reordering`
                                                            : `Open ${service.name || 'service'} in a new tab`}
                                                        aria-pressed={editMode ? isSelected : undefined}
                                                        onClick={() => {
                                                            if (editMode && canEdit === true)
                                                                selectService(service);
                                                            else
                                                                openService(service);
                                                        }}
                                                        onKeyDown={event => {
                                                            if (event.key === 'Enter' || (editMode && event.key === ' ')) {
                                                                event.preventDefault();
                                                                if (editMode && canEdit === true)
                                                                    selectService(service);
                                                                else if (event.key === 'Enter')
                                                                    openService(service);
                                                            }
                                                        }}
                                                        onDragStart={event => {
                                                            if (!editMode || canEdit !== true || saving) {
                                                                event.preventDefault();
                                                                return;
                                                            }
                                                            setSelectedBookmark(selectionKey);
                                                            setDragSource(service);
                                                            event.dataTransfer.effectAllowed = 'move';
                                                            event.dataTransfer.setData('text/plain', service.id || String(service.sourceIndex));
                                                        }}
                                                        onDragEnd={() => setDragSource(null)}
                                                        onDragOver={event => {
                                                            if (editMode && dragSource && serviceGroup(dragSource) === serviceGroup(service)) {
                                                                event.preventDefault();
                                                                event.dataTransfer.dropEffect = 'move';
                                                            }
                                                        }}
                                                        onDrop={event => {
                                                            event.preventDefault();
                                                            reorderBetween(dragSource, service);
                                                            setDragSource(null);
                                                        }}
                                                    >
                                                        <CardTitle style={compactMode ? { padding: '0.65rem 0.75rem 0.35rem' } : undefined}>
                                                            <div className="bookmark-title-row">
                                                                <div className="bookmark-title-main">
                                                                    <span
                                                                        className="bookmark-icon"
                                                                        aria-hidden="true"
                                                                        style={compactMode ? {
                                                                            width: '1.5rem',
                                                                            height: '1.5rem',
                                                                            marginRight: '0.45rem',
                                                                            fontSize: '1rem',
                                                                        } : undefined}
                                                                    >
                                                                        {service.icon || '↗'}
                                                                    </span>
                                                                    <span>{service.name || 'Unnamed service'}</span>
                                                                </div>
                                                                {editMode && canEdit === true && (
                                                                    <div
                                                                        className="bookmark-card-actions"
                                                                        onClick={event => {
                                                                            event.stopPropagation();
                                                                            setSelectedBookmark(selectionKey);
                                                                        }}
                                                                        onKeyDown={event => event.stopPropagation()}
                                                                    >
                                                                        <details className="bookmark-action-menu">
                                                                            <summary
                                                                                aria-label={`Actions for ${service.name || 'service'}`}
                                                                                title="Actions"
                                                                            >
                                                                                ⋮
                                                                            </summary>
                                                                            <div className="bookmark-action-menu-list">
                                                                                <button
                                                                                    type="button"
                                                                                    className="bookmark-action-menu-item"
                                                                                    onClick={event => {
                                                                                        closeActionMenu(event);
                                                                                        openEdit(service);
                                                                                    }}
                                                                                    disabled={saving}
                                                                                >
                                                                                    Edit
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="bookmark-action-menu-item"
                                                                                    onClick={event => {
                                                                                        closeActionMenu(event);
                                                                                        moveWithinGroup(service, -1);
                                                                                    }}
                                                                                    disabled={!canMoveUp || saving}
                                                                                >
                                                                                    ↑ Move up
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className="bookmark-action-menu-item"
                                                                                    onClick={event => {
                                                                                        closeActionMenu(event);
                                                                                        moveWithinGroup(service, 1);
                                                                                    }}
                                                                                    disabled={!canMoveDown || saving}
                                                                                >
                                                                                    ↓ Move down
                                                                                </button>
                                                                                <div className="bookmark-action-menu-separator" />
                                                                                <button
                                                                                    type="button"
                                                                                    className="bookmark-action-menu-item is-danger"
                                                                                    onClick={event => {
                                                                                        closeActionMenu(event);
                                                                                        requestDelete(service);
                                                                                    }}
                                                                                    disabled={saving}
                                                                                >
                                                                                    Delete
                                                                                </button>
                                                                            </div>
                                                                        </details>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardTitle>
                                                        <CardBody style={compactMode ? { padding: '0 0.75rem 0.65rem' } : undefined}>
                                                            <p
                                                                className="bookmark-description"
                                                                style={compactMode ? {
                                                                    fontSize: '0.82rem',
                                                                    lineHeight: 1.35,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                } : undefined}
                                                            >
                                                                {service.description || service.resolvedUrl}
                                                            </p>
                                                            <div
                                                                className="bookmark-meta"
                                                                style={compactMode ? { marginTop: '0.5rem' } : undefined}
                                                            >
                                                                {Array.isArray(service.tags) && service.tags.map(tag => (
                                                                    <span className="bookmark-tag" key={tag}>{tag}</span>
                                                                ))}
                                                            </div>
                                                        </CardBody>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                )}

                <footer className="bookmarks-footer">
                    Configuration: <code>{CONFIG_PATH}</code>
                </footer>
            </main>

            <Modal isOpen={editor !== null} onClose={closeEditor} variant="medium">
                <ModalHeader title={editor?.mode === 'edit' ? 'Edit bookmark' : 'Add bookmark'} />
                <ModalBody>
                    <Form id="bookmark-editor-form" onSubmit={submitEditor}>
                        {warnings.length > 0 && (
                            <Alert isInline variant="warning" title="Possible duplicate">
                                {warnings.join(' ')}
                            </Alert>
                        )}
                        <FormGroup label="Name" isRequired fieldId="bookmark-name">
                            <TextInput
                                id="bookmark-name"
                                value={draft.name}
                                onChange={(_event, value) => updateDraft('name', value)}
                                isRequired
                                validated={formErrors.name ? 'error' : 'default'}
                            />
                            {formErrors.name && <div className="bookmark-field-error">{formErrors.name}</div>}
                        </FormGroup>
                        <FormGroup label="URL" isRequired fieldId="bookmark-url">
                            <TextInput
                                id="bookmark-url"
                                value={draft.url}
                                onChange={(_event, value) => updateDraft('url', value)}
                                placeholder="http://{host}:3000"
                                isRequired
                                validated={formErrors.url ? 'error' : 'default'}
                            />
                            {formErrors.url && <div className="bookmark-field-error">{formErrors.url}</div>}
                            {!formErrors.url && (
                                <div className="bookmark-field-help">
                                    Use <code>{'{host}'}</code> for the Cockpit host name or IP address.
                                    {resolvedPreview && allowedUrl(resolvedPreview) && (
                                        <div>Resolved URL: <code>{resolvedPreview}</code></div>
                                    )}
                                </div>
                            )}
                        </FormGroup>
                        <FormGroup label="Description" fieldId="bookmark-description">
                            <TextArea
                                id="bookmark-description"
                                value={draft.description}
                                onChange={(_event, value) => updateDraft('description', value)}
                                resizeOrientation="vertical"
                            />
                        </FormGroup>
                        <FormGroup label="Group" fieldId="bookmark-group">
                            <TextInput
                                id="bookmark-group"
                                value={draft.group}
                                onChange={(_event, value) => updateDraft('group', value)}
                                placeholder="Monitoring"
                                list="bookmark-group-options"
                            />
                            <datalist id="bookmark-group-options">
                                {groups.filter(group => group !== 'Ungrouped').map(group => <option value={group} key={group} />)}
                            </datalist>
                        </FormGroup>
                        <FormGroup label="Icon" fieldId="bookmark-icon">
                            <TextInput
                                id="bookmark-icon"
                                value={draft.icon}
                                onChange={(_event, value) => updateDraft('icon', value)}
                                placeholder="📊"
                            />
                            <div className="bookmark-icon-presets" aria-label="Common icons">
                                {ICON_PRESETS.map(icon => (
                                    <button
                                        type="button"
                                        className={draft.icon === icon ? 'is-selected' : ''}
                                        onClick={() => updateDraft('icon', icon)}
                                        aria-label={`Use ${icon} icon`}
                                        key={icon}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </FormGroup>
                        <FormGroup label="Tags" fieldId="bookmark-tags">
                            <TextInput
                                id="bookmark-tags"
                                value={draft.tags}
                                onChange={(_event, value) => updateDraft('tags', value)}
                                placeholder="dashboard, monitoring"
                            />
                            <div className="bookmark-field-help">Separate tags with commas. Tags are searchable.</div>
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" type="submit" form="bookmark-editor-form" isDisabled={saving}>
                        {saving ? 'Saving…' : (editor?.mode === 'edit' ? 'Save changes' : 'Add bookmark')}
                    </Button>
                    <Button variant="link" onClick={closeEditor} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={deleteTarget !== null} onClose={() => !saving && setDeleteTarget(null)} variant="small">
                <ModalHeader title="Delete bookmark?" titleIconVariant="danger" />
                <ModalBody>
                    {deleteTarget && (
                        <p>
                            Delete <strong>{deleteTarget.service.name || 'this bookmark'}</strong>? This removes it from {CONFIG_PATH}.
                        </p>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="danger" onClick={deleteBookmark} isDisabled={saving}>
                        {saving ? 'Deleting…' : 'Delete'}
                    </Button>
                    <Button variant="link" onClick={() => setDeleteTarget(null)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={settingsOpen} onClose={() => !saving && setSettingsOpen(false)} variant="medium">
                <ModalHeader title="Page settings" />
                <ModalBody>
                    <Form id="bookmark-settings-form" onSubmit={submitSettings}>
                        <FormGroup label="Title" isRequired fieldId="settings-title">
                            <TextInput
                                id="settings-title"
                                value={settingsDraft.title}
                                onChange={(_event, value) => {
                                    setSettingsDraft(current => ({ ...current, title: value }));
                                    setSettingsError('');
                                }}
                                validated={settingsError ? 'error' : 'default'}
                            />
                            {settingsError && <div className="bookmark-field-error">{settingsError}</div>}
                        </FormGroup>
                        <FormGroup label="Subtitle" fieldId="settings-subtitle">
                            <TextInput
                                id="settings-subtitle"
                                value={settingsDraft.subtitle}
                                onChange={(_event, value) => setSettingsDraft(current => ({ ...current, subtitle: value }))}
                            />
                        </FormGroup>
                        <FormGroup label="Eyebrow" fieldId="settings-eyebrow">
                            <TextInput
                                id="settings-eyebrow"
                                value={settingsDraft.eyebrow}
                                onChange={(_event, value) => setSettingsDraft(current => ({ ...current, eyebrow: value }))}
                                isDisabled={!settingsDraft.showEyebrow}
                            />
                        </FormGroup>
                        <label className="bookmarks-checkbox">
                            <input
                                type="checkbox"
                                checked={settingsDraft.showEyebrow}
                                onChange={event => setSettingsDraft(current => ({ ...current, showEyebrow: event.target.checked }))}
                            />
                            <span>Show eyebrow above the page title</span>
                        </label>
                        <FormGroup label="Display density" fieldId="settings-display-mode">
                            <select
                                id="settings-display-mode"
                                value={settingsDraft.displayMode}
                                onChange={event => setSettingsDraft(current => ({ ...current, displayMode: event.target.value }))}
                                style={{ width: '100%', minHeight: '2.25rem', padding: '0.35rem 0.65rem' }}
                            >
                                {DISPLAY_MODES.map(mode => (
                                    <option value={mode} key={mode}>
                                        {mode === 'compact' ? 'Compact cards' : 'Standard cards'}
                                    </option>
                                ))}
                            </select>
                            <div className="bookmark-field-help">
                                Compact cards fit more services on screen while keeping groups and management controls.
                            </div>
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" type="submit" form="bookmark-settings-form" isDisabled={saving}>
                        {saving ? 'Saving…' : 'Save settings'}
                    </Button>
                    <Button variant="link" onClick={() => setSettingsOpen(false)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={importCandidate !== null} onClose={() => !saving && setImportCandidate(null)} variant="small">
                <ModalHeader title="Import configuration?" />
                <ModalBody>
                    {importCandidate && (
                        <>
                            <p>
                                Replace the current configuration with <strong>{importCandidate.services.length}</strong> imported bookmarks?
                            </p>
                            <p>The current configuration will be kept in History before the import is applied.</p>
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" onClick={confirmImport} isDisabled={saving || !editMode}>
                        {saving ? 'Importing…' : 'Import'}
                    </Button>
                    <Button variant="link" onClick={() => setImportCandidate(null)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={historyOpen} onClose={() => !saving && setHistoryOpen(false)} variant="medium">
                <ModalHeader title="Configuration history" />
                <ModalBody>
                    {config.history.length === 0 ? (
                        <p>No history yet. A snapshot is saved automatically before each configuration change.</p>
                    ) : (
                        <div className="bookmarks-history-list">
                            {[...config.history].reverse().map(entry => (
                                <div className="bookmarks-history-item" key={entry.id || `${entry.savedAt}-${entry.action}`}>
                                    <div>
                                        <strong>{entry.action || 'Configuration changed'}</strong>
                                        <div>{formatHistoryDate(entry.savedAt)}</div>
                                        <div>{entry.config?.services?.length ?? 0} bookmarks</div>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() => restoreHistory(entry)}
                                        isDisabled={saving || !editMode}
                                    >
                                        Restore
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => setHistoryOpen(false)} isDisabled={saving}>Close</Button>
                </ModalFooter>
            </Modal>
        </Page>
    );
};
