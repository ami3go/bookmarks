import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';

import { serviceGroup } from './bookmarks.js';
import { ServiceCard } from './service-card.jsx';
import { serviceStatusKey } from './use-service-statuses.js';

export function ServiceGroup({
    sectionIndex,
    collapseKey,
    group,
    services,
    isFavorites,
    isCollapsed,
    groups,
    configServices,
    statuses,
    launcherStates,
    hostname,
    editMode,
    canEdit,
    saving,
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
    onShowQr,
}) {
    const headingId = `bookmark-group-heading-${sectionIndex}`;

    return (
        <section className={`bookmark-group-section${isFavorites ? ' is-favorites' : ''}`} aria-labelledby={headingId}>
            <div className="bookmark-group-heading">
                <Button
                    variant="plain"
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group} group`}
                    aria-expanded={!isCollapsed}
                    title={isCollapsed ? 'Expand group' : 'Collapse group'}
                    onClick={() => onToggleGroupCollapsed(collapseKey)}
                >
                    <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                </Button>
                <h2 id={headingId}>{group}</h2>
                <span>{services.length}</span>
                {editMode && canEdit === true && !isFavorites && groups.length > 1 && (
                    <div className="bookmark-group-order-actions" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
                        <Button variant="plain" aria-label={`Move ${group} group up`} title="Move group up" isDisabled={groups[0] === group || saving} onClick={() => onMoveGroupWithinOrder(group, -1)}>↑</Button>
                        <Button variant="plain" aria-label={`Move ${group} group down`} title="Move group down" isDisabled={groups[groups.length - 1] === group || saving} onClick={() => onMoveGroupWithinOrder(group, 1)}>↓</Button>
                    </div>
                )}
            </div>

            {!isCollapsed && (
                <div className={`bookmarks-grid${compactMode ? ' is-compact' : ''}`}>
                    {services.map(service => {
                        const siblingIndexes = isFavorites ? [] : configServices
                            .map((item, index) => ({ item, index }))
                            .filter(({ item }) => serviceGroup(item) === serviceGroup(service))
                            .map(({ index }) => index);
                        const position = siblingIndexes.indexOf(service.sourceIndex);
                        return (
                            <ServiceCard
                                key={service.id || `${service.sourceIndex}-${service.resolvedUrl}`}
                                service={service}
                                status={statuses[serviceStatusKey(service)]}
                                launcherState={launcherStates.get(service.id)}
                                hostname={hostname}
                                editMode={editMode}
                                canEdit={canEdit}
                                saving={saving}
                                isFavorites={isFavorites}
                                canMoveUp={!isFavorites && position > 0}
                                canMoveDown={!isFavorites && position >= 0 && position < siblingIndexes.length - 1}
                                selectedBookmark={selectedBookmark}
                                dragSource={dragSource}
                                compactMode={compactMode}
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
                                onShowQr={onShowQr}
                            />
                        );
                    })}
                </div>
            )}
        </section>
    );
}
