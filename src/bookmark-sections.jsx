import React, { useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';

import { ServiceGroup } from './service-group.jsx';
import { ServiceQrDialog } from './service-qr-dialog.jsx';
import { useLauncherStates } from './use-launcher-states.js';
import { useServiceStatuses } from './use-service-statuses.js';

export function BookmarkSections({
    sections,
    collapsedGroups,
    query,
    editMode,
    canEdit,
    groups,
    saving,
    configServices,
    selectedBookmark,
    dragSource,
    compactMode,
    onToggleGroupCollapsed,
    onMoveGroupWithinOrder,
    onSelectService,
    onOpenService,
    onStopLauncher,
    onRestartLauncher,
    onViewOutput,
    onSetSelectedBookmark,
    onSetDragSource,
    onReorderBetween,
    onOpenEdit,
    onToggleFavorite,
    onDuplicateService,
    onOpenMoveToGroup,
    onMoveWithinGroup,
    onRequestDelete,
}) {
    const [qrTarget, setQrTarget] = useState(null);
    const hostname = window.location.hostname;
    const { statuses, refreshing, refresh, summary } = useServiceStatuses(configServices, hostname);
    const { states: launcherStates } = useLauncherStates(configServices);

    return (
        <>
            <div className="bookmarks-service-summary" role="status" aria-live="polite">
                <span>
                    Services: <strong>{summary.online} online</strong> · {summary.offline} offline · {summary.unknown} unknown
                </span>
                <Button variant="link" onClick={refresh} isDisabled={refreshing}>
                    {refreshing ? 'Checking…' : 'Refresh'}
                </Button>
            </div>

            <div className="bookmark-groups">
                {sections.map(({ sectionKey, collapseKey, name: group, items, isFavorites }, sectionIndex) => (
                    <ServiceGroup
                        key={sectionKey}
                        sectionIndex={sectionIndex}
                        collapseKey={collapseKey}
                        group={group}
                        services={items}
                        isFavorites={isFavorites}
                        isCollapsed={collapsedGroups.has(collapseKey) && !query.trim()}
                        groups={groups}
                        configServices={configServices}
                        statuses={statuses}
                        launcherStates={launcherStates}
                        hostname={hostname}
                        editMode={editMode}
                        canEdit={canEdit}
                        saving={saving}
                        selectedBookmark={selectedBookmark}
                        dragSource={dragSource}
                        compactMode={compactMode}
                        onToggleGroupCollapsed={onToggleGroupCollapsed}
                        onMoveGroupWithinOrder={onMoveGroupWithinOrder}
                        onSelectService={onSelectService}
                        onOpenService={onOpenService}
                        onStopLauncher={onStopLauncher}
                        onRestartLauncher={onRestartLauncher}
                        onViewOutput={onViewOutput}
                        onSetSelectedBookmark={onSetSelectedBookmark}
                        onSetDragSource={onSetDragSource}
                        onReorderBetween={onReorderBetween}
                        onOpenEdit={onOpenEdit}
                        onToggleFavorite={onToggleFavorite}
                        onDuplicateService={onDuplicateService}
                        onOpenMoveToGroup={onOpenMoveToGroup}
                        onMoveWithinGroup={onMoveWithinGroup}
                        onRequestDelete={onRequestDelete}
                        onShowQr={setQrTarget}
                    />
                ))}
            </div>

            <ServiceQrDialog target={qrTarget} onClose={() => setQrTarget(null)} onOpenService={onOpenService} />
        </>
    );
}
