import React, { useState } from 'react';
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
import { LauncherOutputDialog } from './launcher-output-dialog.jsx';
import { ManagementDialogs } from './management-dialogs.jsx';
import { readServiceOutput, restartService, stopService } from './service-runtime.js';
import { useBookmarkManagement } from './use-bookmark-management.js';
import { useDashboardView } from './use-dashboard-view.js';
import { usePageSettings } from './use-page-settings.js';

function runtimeError(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export const Application = () => {
    const { config, configError, configMissing, loaded } = useConfiguration();
    const canEdit = useAdminPermission();
    const pageSettings = usePageSettings(config);
    const displayConfig = pageSettings.previewConfig;
    const view = useDashboardView(displayConfig, loaded, pageSettings.open);
    const management = useBookmarkManagement({ config, configError, configMissing, canEdit, view, pageSettings });
    const [outputTarget, setOutputTarget] = useState(null);
    const [outputText, setOutputText] = useState('');
    const [outputLoading, setOutputLoading] = useState(false);

    const stopLauncher = async service => {
        try {
            await stopService(service);
            management.setNotice({ variant: 'success', text: `${service.name || 'Launcher'} stopped.` });
        } catch (error) {
            management.setNotice({ variant: 'danger', text: `Could not stop ${service.name || 'launcher'}: ${runtimeError(error)}` });
        }
    };

    const restartLauncher = async service => {
        try {
            await restartService(service);
            management.setNotice({ variant: 'success', text: `${service.name || 'Launcher'} restarted.` });
        } catch (error) {
            management.setNotice({ variant: 'danger', text: `Could not restart ${service.name || 'launcher'}: ${runtimeError(error)}` });
        }
    };

    const loadOutput = async service => {
        if (!service)
            return;
        setOutputTarget(service);
        setOutputLoading(true);
        try {
            setOutputText(await readServiceOutput(service));
        } catch (error) {
            setOutputText(`Could not read launcher output: ${runtimeError(error)}`);
        } finally {
            setOutputLoading(false);
        }
    };

    return (
        <Page className="pf-m-no-sidebar">
            <main className="bookmarks-page">
                <DashboardHeader
                    config={displayConfig}
                    editMode={management.editMode}
                    previewSettings={pageSettings.open}
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

                <input ref={management.fileInputRef} className="bookmarks-file-input" type="file" accept="application/json,.json" onChange={management.handleImportFile} />

                {management.notice && <Alert isInline variant={management.notice.variant} title={management.notice.text} className="bookmarks-notice" />}

                {!loaded ? (
                    <div className="bookmarks-empty" role="status">Loading configuration…</div>
                ) : config.services.length === 0 ? (
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
                        query={view.filterQuery}
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
                        onStopLauncher={stopLauncher}
                        onRestartLauncher={restartLauncher}
                        onViewOutput={loadOutput}
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

                <footer className="bookmarks-footer">Configuration: <code>{CONFIG_PATH}</code></footer>
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
                deleteStopFailed={management.deleteStopFailed}
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

            <AddAppManager isOpen={management.addAppOpen} onClose={() => management.setAddAppOpen(false)} onSaved={service => management.setNotice({ variant: 'success', text: `${service.name} added.` })} />

            <LauncherEditorDialog
                service={management.launcherEditorService}
                onClose={() => management.setLauncherEditorService(null)}
                onSaved={service => {
                    management.setSelectedBookmark(null);
                    management.setNotice({ variant: 'success', text: `${service.name} updated.` });
                }}
            />

            <LauncherOutputDialog
                target={outputTarget}
                output={outputText}
                loading={outputLoading}
                onRefresh={() => loadOutput(outputTarget)}
                onClose={() => {
                    setOutputTarget(null);
                    setOutputText('');
                }}
            />
        </Page>
    );
};
