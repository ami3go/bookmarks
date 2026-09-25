import { useEffect, useMemo, useRef, useState } from 'react';

import { APPLICATION_LAUNCHER_TYPE } from './application-launcher.js';
import {
    CONFIG_PATH,
    CONFIG_SYNTAX,
    EMPTY_BOOKMARK,
    MAX_CONFIG_SIZE,
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
    restoreHistoryEntry,
    serviceGroup,
    storedBookmark,
    validateBookmark,
} from './bookmarks.js';
import { runtimeFreeService, serviceSelectionKey } from './bookmark-ui.js';
import { modifyConfiguration } from './cockpit-config.js';
import { normalizeImportedConfiguration } from './import-config.js';
import { applyPageSettings } from './page-settings.js';
import { isLauncherService, openService as openConfiguredService, stopService } from './service-runtime.js';
import { TERMINAL_LAUNCHER_TYPE } from './terminal-launcher.js';
import { useDashboardKeyboard, useEditModeTimeout } from './use-dashboard-shortcuts.js';

function launcherEditorType(service) {
    if (service?.type === TERMINAL_LAUNCHER_TYPE)
        return 'terminal';
    if (service?.type === APPLICATION_LAUNCHER_TYPE)
        return 'application';
    return null;
}

function cockpitMessage(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export function useBookmarkManagement({ config, configError, configMissing, canEdit, view, pageSettings }) {
    const {
        hostname,
        query,
        setQuery,
        setGroupFilter,
        groups,
        setDragSource,
    } = view;
    const closePageSettings = pageSettings.close;

    const [notice, setNotice] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [selectedBookmark, setSelectedBookmark] = useState(null);
    const [editor, setEditor] = useState(null);
    const [launcherEditorService, setLauncherEditorService] = useState(null);
    const [addAppOpen, setAddAppOpen] = useState(false);
    const [draft, setDraft] = useState(EMPTY_BOOKMARK);
    const [formErrors, setFormErrors] = useState({});
    const [writeErrors, setWriteErrors] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteStopFailed, setDeleteStopFailed] = useState(false);
    const [moveTarget, setMoveTarget] = useState(null);
    const [moveGroupDraft, setMoveGroupDraft] = useState('Ungrouped');
    const [saving, setSaving] = useState(false);
    const [importCandidate, setImportCandidate] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [discoveryOpen, setDiscoveryOpen] = useState(false);
    const [terminalManagerOpen, setTerminalManagerOpen] = useState(false);
    const fileInputRef = useRef(null);

    const settingsOpen = pageSettings.open;
    const settingsDraft = pageSettings.draft;
    const settingsError = pageSettings.error;

    useEffect(() => {
        if (configError) {
            setNotice({
                variant: 'danger',
                text: `Could not monitor ${CONFIG_PATH}: ${cockpitMessage(configError)}`,
            });
        }
    }, [configError]);

    useEffect(() => {
        if (configMissing) {
            setNotice({
                variant: 'info',
                text: `No configuration found. Add your first bookmark to create ${CONFIG_PATH}.`,
            });
        }
    }, [configMissing]);

    useEffect(() => {
        if (canEdit === false) {
            setEditMode(false);
            setAddAppOpen(false);
            setLauncherEditorService(null);
            closePageSettings();
        }
    }, [canEdit, closePageSettings]);

    useEffect(() => {
        if (!editMode) {
            setSelectedBookmark(null);
            setDragSource(null);
        }
    }, [editMode, setDragSource]);

    const managementOpen = Boolean(
        editor || launcherEditorService || deleteTarget || moveTarget || settingsOpen || importCandidate ||
        historyOpen || discoveryOpen || terminalManagerOpen || addAppOpen
    );

    useEditModeTimeout(editMode, setEditMode, managementOpen);
    useDashboardKeyboard({ query, setQuery, showSearch: config.showSearch, managementOpen });

    const currentTarget = editor?.mode === 'edit' ? editor.target : null;
    const warnings = useMemo(
        () => duplicateWarnings(draft, config.services, currentTarget, hostname),
        [draft, config.services, currentTarget, hostname]
    );
    const resolvedPreview = draft.url.trim() ? expandUrl(draft.url.trim(), hostname) : '';

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
            .then(result => {
                setSaving(false);
                const trimmed = result?.writeInfo?.historyTrimmed || 0;
                setNotice({
                    variant: trimmed ? 'warning' : 'success',
                    text: trimmed
                        ? `${successText} ${trimmed} oldest history entr${trimmed === 1 ? 'y was' : 'ies were'} removed to keep the configuration below ${MAX_CONFIG_SIZE.toLocaleString()} bytes.`
                        : successText,
                });
                onSuccess?.();
            })
            .catch(error => {
                setSaving(false);
                const text = `Could not update ${CONFIG_PATH}: ${cockpitMessage(error)}`;
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
        const launcherType = launcherEditorType(storedService);

        if (launcherType) {
            if (!storedService.id) {
                setNotice({ variant: 'danger', text: `This ${launcherType} launcher has no stable ID and cannot be edited safely.` });
                return;
            }
            setEditor(null);
            setFormErrors({});
            setLauncherEditorService(storedService);
            return;
        }

        setLauncherEditorService(null);
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
        setDeleteStopFailed(false);
        setSelectedBookmark(serviceSelectionKey(service));
        setDeleteTarget({ index: service.sourceIndex, service: runtimeFreeService(service) });
    };

    const deleteBookmark = async ({ force = false } = {}) => {
        if (!deleteTarget)
            return;

        clearWriteError('delete');
        setSaving(true);
        setNotice(null);
        try {
            if (isLauncherService(deleteTarget.service) && !force) {
                try {
                    await stopService(deleteTarget.service);
                } catch (stopError) {
                    const text = `Could not stop ${deleteTarget.service.name || 'launcher'} before deleting it: ${cockpitMessage(stopError)}. You can retry, or explicitly choose Delete anyway.`;
                    setNotice({ variant: 'danger', text });
                    setWriteErrors(current => ({ ...current, delete: text }));
                    setDeleteStopFailed(true);
                    return;
                }
            }

            await modifyConfiguration(current => {
                const index = findBookmarkIndex(current.services, deleteTarget);
                if (index === -1)
                    throw new Error('This bookmark was changed or removed. Reload the page and try again.');
                return {
                    ...current,
                    services: current.services.filter((_, serviceIndex) => serviceIndex !== index),
                };
            }, `Deleted ${deleteTarget.service?.name || 'bookmark'}`);

            setNotice({ variant: 'success', text: 'Bookmark deleted.' });
            setDeleteTarget(null);
            setDeleteStopFailed(false);
            setSelectedBookmark(null);
        } catch (error) {
            const text = `Could not update ${CONFIG_PATH}: ${cockpitMessage(error)}`;
            setNotice({ variant: 'danger', text });
            setWriteErrors(current => ({ ...current, delete: text }));
        } finally {
            setSaving(false);
        }
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
        if (isLauncherService(service)) {
            setNotice({ variant: 'info', text: 'Use Add app to create another launcher so a new port and launcher URL can be allocated safely.' });
            return;
        }

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

    const toggleEditMode = () => {
        if (canEdit !== true || saving)
            return;
        setEditMode(current => !current);
    };

    const openSettings = () => {
        if (!editMode)
            return;
        clearWriteError('settings');
        pageSettings.openFor(config);
    };

    const submitSettings = event => {
        event.preventDefault();
        const nextSettings = applyPageSettings(config, settingsDraft);
        if (!String(nextSettings.title || '').trim()) {
            pageSettings.setError('Title is required.');
            return;
        }

        modifyConfig(current => applyPageSettings(current, settingsDraft), 'Page settings updated.', () => pageSettings.close(), 'Updated page settings', 'settings');
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
            setImportCandidate(normalizeImportedConfiguration(parsed, hostname));
        } catch (error) {
            setNotice({ variant: 'danger', text: `Could not import JSON: ${error.message}` });
        }
    };

    const confirmImport = () => {
        if (!importCandidate || !editMode)
            return;

        modifyConfig(current => ({
            ...importCandidate.config,
            history: current.history,
        }), `Imported ${importCandidate.config.services.length} bookmarks.`, () => {
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

    return {
        notice,
        setNotice,
        editMode,
        setEditMode,
        selectedBookmark,
        setSelectedBookmark,
        editor,
        launcherEditorService,
        setLauncherEditorService,
        addAppOpen,
        setAddAppOpen,
        draft,
        formErrors,
        writeErrors,
        deleteTarget,
        setDeleteTarget,
        deleteStopFailed,
        moveTarget,
        setMoveTarget,
        moveGroupDraft,
        setMoveGroupDraft,
        saving,
        settingsOpen,
        setSettingsOpen: pageSettings.setOpen,
        settingsDraft,
        setSettingsDraft: pageSettings.setDraft,
        settingsError,
        setSettingsError: pageSettings.setError,
        importCandidate,
        setImportCandidate,
        historyOpen,
        setHistoryOpen,
        setDiscoveryOpen,
        setTerminalManagerOpen,
        fileInputRef,
        warnings,
        resolvedPreview,
        clearWriteError,
        openAdd,
        openEdit,
        closeEditor,
        updateDraft,
        submitEditor,
        requestDelete,
        deleteBookmark,
        openMoveToGroup,
        moveBookmarkToGroup,
        toggleFavorite,
        duplicateService,
        openService: openConfiguredService,
        selectService,
        reorderBetween,
        moveWithinGroup,
        moveGroupWithinOrder,
        toggleEditMode,
        openSettings,
        submitSettings,
        exportConfig,
        handleImportFile,
        confirmImport,
        openHistory,
        restoreHistory,
    };
}
