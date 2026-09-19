import React from 'react';

import { BookmarkEditorDialog } from './bookmark-editor-dialog.jsx';
import { DeleteBookmarkDialog } from './delete-bookmark-dialog.jsx';
import { HistoryDialog } from './history-dialog.jsx';
import { ImportConfigDialog } from './import-config-dialog.jsx';
import { MoveBookmarkDialog } from './move-bookmark-dialog.jsx';
import { PageSettingsDialog } from './page-settings-dialog.jsx';

export function ManagementDialogs({
    editor,
    closeEditor,
    writeErrors,
    submitEditor,
    warnings,
    draft,
    updateDraft,
    formErrors,
    resolvedPreview,
    groups,
    saving,
    moveTarget,
    setMoveTarget,
    moveGroupDraft,
    setMoveGroupDraft,
    clearWriteError,
    moveBookmarkToGroup,
    editMode,
    deleteTarget,
    setDeleteTarget,
    deleteStopFailed,
    deleteBookmark,
    settingsOpen,
    setSettingsOpen,
    settingsDraft,
    setSettingsDraft,
    settingsError,
    setSettingsError,
    submitSettings,
    importCandidate,
    setImportCandidate,
    confirmImport,
    historyOpen,
    setHistoryOpen,
    config,
    restoreHistory,
}) {
    const updateSetting = (field, value) => {
        clearWriteError('settings');
        setSettingsDraft(current => ({ ...current, [field]: value }));
    };

    return (
        <>
            <BookmarkEditorDialog
                editor={editor}
                onClose={closeEditor}
                error={writeErrors.editor}
                onSubmit={submitEditor}
                warnings={warnings}
                draft={draft}
                onChange={updateDraft}
                formErrors={formErrors}
                resolvedPreview={resolvedPreview}
                groups={groups}
                saving={saving}
            />

            <MoveBookmarkDialog
                target={moveTarget}
                onClose={() => setMoveTarget(null)}
                error={writeErrors.move}
                groups={groups}
                value={moveGroupDraft}
                onChange={value => {
                    clearWriteError('move');
                    setMoveGroupDraft(value);
                }}
                onMove={moveBookmarkToGroup}
                editMode={editMode}
                saving={saving}
            />

            <DeleteBookmarkDialog
                target={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                error={writeErrors.delete}
                stopFailed={deleteStopFailed}
                onDelete={deleteBookmark}
                saving={saving}
            />

            <PageSettingsDialog
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                error={writeErrors.settings}
                draft={settingsDraft}
                onChange={updateSetting}
                titleError={settingsError}
                setTitleError={setSettingsError}
                onSubmit={submitSettings}
                saving={saving}
            />

            <ImportConfigDialog
                candidate={importCandidate}
                onClose={() => setImportCandidate(null)}
                error={writeErrors.import}
                onConfirm={confirmImport}
                editMode={editMode}
                saving={saving}
            />

            <HistoryDialog
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                error={writeErrors.history}
                history={config.history}
                onRestore={restoreHistory}
                editMode={editMode}
                saving={saving}
            />
        </>
    );
}
