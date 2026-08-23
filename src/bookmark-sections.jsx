import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card/index.js';

import { serviceGroup } from './bookmarks.js';
import { closeActionMenu, serviceSelectionKey } from './bookmark-ui.js';

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
    return (
        <div className="bookmark-groups">
            {sections.map(({ sectionKey, collapseKey, name: group, items: groupServices, isFavorites }, sectionIndex) => {
                const headingId = `bookmark-group-heading-${sectionIndex}`;
                const isCollapsed = collapsedGroups.has(collapseKey) && !query.trim();
                return (
                    <section className={`bookmark-group-section${isFavorites ? ' is-favorites' : ''}`} key={sectionKey} aria-labelledby={headingId}>
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
                            <span>{groupServices.length}</span>
                            {editMode && canEdit === true && !isFavorites && groups.length > 1 && (
                                <div
                                    className="bookmark-group-order-actions"
                                    onClick={event => event.stopPropagation()}
                                    onKeyDown={event => event.stopPropagation()}
                                >
                                    <Button
                                        variant="plain"
                                        aria-label={`Move ${group} group up`}
                                        title="Move group up"
                                        isDisabled={groups[0] === group || saving}
                                        onClick={() => onMoveGroupWithinOrder(group, -1)}
                                    >
                                        ↑
                                    </Button>
                                    <Button
                                        variant="plain"
                                        aria-label={`Move ${group} group down`}
                                        title="Move group down"
                                        isDisabled={groups[groups.length - 1] === group || saving}
                                        onClick={() => onMoveGroupWithinOrder(group, 1)}
                                    >
                                        ↓
                                    </Button>
                                </div>
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className={`bookmarks-grid${compactMode ? ' is-compact' : ''}`}>
                                {groupServices.map(service => {
                                    const siblingIndexes = isFavorites ? [] : configServices
                                        .map((item, index) => ({ item, index }))
                                        .filter(({ item }) => serviceGroup(item) === serviceGroup(service))
                                        .map(({ index }) => index);
                                    const groupPosition = siblingIndexes.indexOf(service.sourceIndex);
                                    const canMoveUp = !isFavorites && groupPosition > 0;
                                    const canMoveDown = !isFavorites && groupPosition >= 0 && groupPosition < siblingIndexes.length - 1;
                                    const selectionKey = serviceSelectionKey(service);
                                    const isSelected = editMode && selectedBookmark === selectionKey;
                                    const isDragging = dragSource?.sourceIndex === service.sourceIndex;
                                    const opensSameTab = service.openMode === 'same-tab';

                                    return (
                                        <Card
                                            className={`bookmark-card${compactMode ? ' is-compact' : ''}${editMode ? ' is-editable' : ''}${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
                                            key={service.id || `${service.sourceIndex}-${service.resolvedUrl}`}
                                            role={editMode ? 'button' : 'link'}
                                            tabIndex={0}
                                            draggable={!isFavorites && editMode && canEdit === true && !saving}
                                            aria-label={editMode
                                                ? `${isFavorites ? 'Select' : 'Select for reordering'} ${service.name || 'service'}`
                                                : `Open ${service.name || 'service'} in ${opensSameTab ? 'the same tab' : 'a new tab'}`}
                                            aria-pressed={editMode ? isSelected : undefined}
                                            onClick={() => {
                                                if (editMode && canEdit === true)
                                                    onSelectService(service);
                                                else
                                                    onOpenService(service);
                                            }}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter' || (editMode && event.key === ' ')) {
                                                    event.preventDefault();
                                                    if (editMode && canEdit === true)
                                                        onSelectService(service);
                                                    else if (event.key === 'Enter')
                                                        onOpenService(service);
                                                }
                                            }}
                                            onDragStart={event => {
                                                if (isFavorites || !editMode || canEdit !== true || saving) {
                                                    event.preventDefault();
                                                    return;
                                                }
                                                onSetSelectedBookmark(selectionKey);
                                                onSetDragSource(service);
                                                event.dataTransfer.effectAllowed = 'move';
                                                event.dataTransfer.setData('text/plain', service.id || String(service.sourceIndex));
                                            }}
                                            onDragEnd={() => onSetDragSource(null)}
                                            onDragOver={event => {
                                                if (!isFavorites && editMode && dragSource && serviceGroup(dragSource) === serviceGroup(service)) {
                                                    event.preventDefault();
                                                    event.dataTransfer.dropEffect = 'move';
                                                }
                                            }}
                                            onDrop={event => {
                                                event.preventDefault();
                                                if (!isFavorites)
                                                    onReorderBetween(dragSource, service);
                                                onSetDragSource(null);
                                            }}
                                        >
                                            <CardTitle>
                                                <div className="bookmark-title-row">
                                                    <div className="bookmark-title-main">
                                                        <span className="bookmark-icon" aria-hidden="true">{service.icon || '↗'}</span>
                                                        <span>{service.name || 'Unnamed service'}</span>
                                                        {service.favorite === true && <span aria-hidden="true" title="Favorite">★</span>}
                                                    </div>
                                                    {editMode && canEdit === true && (
                                                        <div
                                                            className="bookmark-card-actions"
                                                            onClick={event => {
                                                                event.stopPropagation();
                                                                onSetSelectedBookmark(selectionKey);
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
                                                                            onOpenEdit(service);
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
                                                                            onToggleFavorite(service);
                                                                        }}
                                                                        disabled={saving}
                                                                    >
                                                                        {service.favorite === true ? '★ Remove from Favorites' : '☆ Add to Favorites'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="bookmark-action-menu-item"
                                                                        onClick={event => {
                                                                            closeActionMenu(event);
                                                                            onDuplicateService(service);
                                                                        }}
                                                                        disabled={saving}
                                                                    >
                                                                        Duplicate
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="bookmark-action-menu-item"
                                                                        onClick={event => {
                                                                            closeActionMenu(event);
                                                                            onOpenMoveToGroup(service);
                                                                        }}
                                                                        disabled={saving}
                                                                    >
                                                                        Move to group…
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="bookmark-action-menu-item"
                                                                        onClick={event => {
                                                                            closeActionMenu(event);
                                                                            onMoveWithinGroup(service, -1);
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
                                                                            onMoveWithinGroup(service, 1);
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
                                                                            onRequestDelete(service);
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
                                            <CardBody>
                                                <p className="bookmark-description">{service.description || service.resolvedUrl}</p>
                                                <div className="bookmark-meta">
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
    );
}
