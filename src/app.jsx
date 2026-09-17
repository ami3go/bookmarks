import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Page } from '@patternfly/react-core/dist/esm/components/Page/index.js';

import { AddAppManager } from './add-app-manager.jsx';
import { useAdminPermission, useConfiguration } from './app-providers.jsx';
import { CONFIG_PATH } from './bookmarks.js';
import { BookmarkSections } from './bookmark-sections.jsx';
import { DashboardHeader } from './dashboard-header.jsx';
import { EditToolbar } from './edit-toolbar.jsx';
import { LauncherEditorDialog } from './launcher-editor-dialog.jsx';
import { ManagementDialogs } from './management-dialogs.jsx';
import { useBookmarkManagement } from './use-bookmark-management.js';
import { useDashboardView } from './use-dashboard-view.js';

export const Application = () => {
    const { config, configError, configMissing } = useConfiguration();
    const canEdit = useAdminPermission();
    const view = useDashboardView(config);
    const management = useBookmarkManagement({ config, configError, configMissing, canEdit, view });

    return (
        <Page className="pf-m-no-sidebar">
            <main className="bookmarks-page">
                <DashboardHeader
                    config={config}
                    editMode={management.editMode}
                    canEdit={canEdit}
                    saving={management.saving}
                    query={view.query}
                    setQuery={view.setQuery}
                    groupFilter={view.groupFilter}
                    setGroupFilter={view.setGroupFilter}
                    groups={view.groups}
                    onAddBookmark={management.openAdd}
                    onAddApp={() => management.setAddAppOpen(true)}
                    onToggleEditMode={management.toggleEditMode}
                />

                {canEdit === false && (
                    <Alert isInline variant="info" title="Read-only mode" className="bookmarks-notice">
                        Administrator privileges are required to add, edit, delete, reorder, or import bookmarks.
                    </Alert>
                )}

                <EditToolbar
                    visible={management.editMode && canEdit === true}
                    historyCount={config.history.length}
                    fileInputRef={management.fileInputRef}
                    onOpenSettings={management.openSettings}
                    onExport={management.exportConfig}
                    onOpenHistory={management.openHistory}
                    onTerminalManagerOpenChange={management.setTerminalManagerOpen}
                    onDiscoveryOpenChange={management.setDiscoveryOpen}
                />

                <input
                    ref={management.fileInputRef}
                    className="bookmarks-file-input"
                    type="file"
                    accept="application/json,.json"
                    onChange={management.handleImportFile}
                />

                {management.notice && (
                    <Alert isInline variant={management.notice.variant} title={management.notice.text} className="bookmarks-notice" />
                )}

                {config.services.length === 0 ? (
                    <div className="bookmarks-empty bookmarks-empty-first-run">
                        <h2>Add your first service</h2>
                        <p>
                            Bookmarks are stored in <code>{CONFIG_PATH}</code>. Use <code>{'{host}'}</code> in a URL to reuse
                            the hostname or IP address that opened Cockpit.
                        </p>
                        {canEdit === true && <Button variant="primary" onClick={management.openAdd}>Add your first bookmark</Button>}
                    </div>
                ) : view.services.length === 0 ? (
                    <div className="bookmarks-empty">
                        <h2>No matching bookmarks</h2>
                        <p>Change the search text or group filter to show more services.</p>
                        <Button variant="secondary" onClick={view.clearFilters}>Clear filters</Button>
                    </div>
                ) : (
                    <BookmarkSections
                        sections={view.sections}
                        collapsedGroups={view.collapsedGroups}
                        query={view.query}
                        editMode={management.editMode}
                        canEdit={canEdit}
                        groups={view.groups}
                        saving={management.saving}
                        configServices={config.services}
                        selectedBookmark={management.selectedBookmark}
                        dragSource={view.dragSource}
                        compactMode={view.compactMode}
                        onToggleGroupCollapsed={view.toggleGroupCollapsed}
                        onMoveGroupWithinOrder={management.moveGroupWithinOrder}
                        onSelectService={management.selectService}
                        onOpenService={management.openService}
                        onSetSelectedBookmark={management.setSelectedBookmark}
                        onSetDragSource={view.setDragSource}
                        onReorderBetween={management.reorderBetween}
                        onOpenEdit={management.openEdit}
                        onToggleFavorite={management.toggleFavorite}
                        onDuplicateService={management.duplicateService}
                        onOpenMoveToGroup={management.openMoveToGroup}
                        onMoveWithinGroup={management.moveWithinGroup}
                        onRequestDelete={management.requestDelete}
                    />
                )}

                <footer className="bookmarks-footer">
                    Configuration: <code>{CONFIG_PATH}</code>
                </footer>
            </main>

            <ManagementDialogs
                editor={management.editor}
                closeEditor={management.closeEditor}
                writeErrors={management.writeErrors}
                submitEditor={management.submitEditor}
                warnings={management.warnings}
                draft={management.draft}
                updateDraft={management.updateDraft}
                formErrors={management.formErrors}
                resolvedPreview={management.resolvedPreview}
                groups={view.groups}
                saving={management.saving}
                moveTarget={management.moveTarget}
                setMoveTarget={management.setMoveTarget}
                moveGroupDraft={management.moveGroupDraft}
                setMoveGroupDraft={management.setMoveGroupDraft}
                clearWriteError={management.clearWriteError}
                moveBookmarkToGroup={management.moveBookmarkToGroup}
                editMode={management.editMode}
                deleteTarget={management.deleteTarget}
                setDeleteTarget={management.setDeleteTarget}
                deleteBookmark={management.deleteBookmark}
                settingsOpen={management.settingsOpen}
                setSettingsOpen={management.setSettingsOpen}
                settingsDraft={management.settingsDraft}
                setSettingsDraft={management.setSettingsDraft}
                settingsError={management.settingsError}
                setSettingsError={management.setSettingsError}
                submitSettings={management.submitSettings}
                importCandidate={management.importCandidate}
                setImportCandidate={management.setImportCandidate}
                confirmImport={management.confirmImport}
                historyOpen={management.historyOpen}
                setHistoryOpen={management.setHistoryOpen}
                config={config}
                restoreHistory={management.restoreHistory}
            />

            <AddAppManager
                isOpen={management.addAppOpen}
                onClose={() => management.setAddAppOpen(false)}
                onSaved={service => management.setNotice({ variant: 'success', text: `${service.name} added.` })}
            />

            <LauncherEditorDialog
                service={management.launcherEditorService}
                onClose={() => management.setLauncherEditorService(null)}
                onSaved={service => {
                    management.setSelectedBookmark(null);
                    management.setNotice({ variant: 'success', text: `${service.name} updated.` });
                }}
            />
        </Page>
    );
};
