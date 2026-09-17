import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card/index.js';

import { normalizeAccent, serviceEndpoints, serviceGroup } from './bookmarks.js';
import { serviceSelectionKey } from './bookmark-ui.js';
import { SelectControl } from './form-controls.jsx';
import { ServiceActionMenu } from './service-action-menu.jsx';
import { serviceStatusKey, statusLabel } from './use-service-statuses.js';

export function ServiceCard({
    service,
    status,
    hostname,
    editMode,
    canEdit,
    saving,
    isFavorites,
    canMoveUp,
    canMoveDown,
    selectedBookmark,
    dragSource,
    compactMode,
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
    onShowQr,
}) {
    const [endpointIndex, setEndpointIndex] = useState(0);
    const endpoints = useMemo(() => serviceEndpoints(service, hostname), [service, hostname]);

    useEffect(() => {
        if (endpointIndex >= endpoints.length)
            setEndpointIndex(0);
    }, [endpointIndex, endpoints.length]);

    const selectedEndpoint = endpoints[endpointIndex] || { label: 'Primary', url: service.resolvedUrl };
    const selectionKey = serviceSelectionKey(service);
    const isSelected = editMode && selectedBookmark === selectionKey;
    const isDragging = dragSource?.sourceIndex === service.sourceIndex;
    const opensSameTab = service.openMode === 'same-tab';
    const serviceStatus = status || { state: 'unknown' };
    const accent = normalizeAccent(service.accent);
    const statusKey = serviceStatusKey(service);

    return (
        <Card
            className={`bookmark-card${compactMode ? ' is-compact' : ''}${editMode ? ' is-editable' : ''}${isSelected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}${accent !== 'none' ? ` bookmark-accent-${accent}` : ''}`}
            key={service.id || `${service.sourceIndex}-${service.resolvedUrl}`}
            role={editMode ? 'button' : 'link'}
            tabIndex={0}
            draggable={!isFavorites && editMode && canEdit === true && !saving}
            aria-label={editMode
                ? `${isFavorites ? 'Select' : 'Select for reordering'} ${service.name || 'service'}`
                : `Open ${service.name || 'service'} using ${selectedEndpoint.label} in ${opensSameTab ? 'the same tab' : 'a new tab'}`}
            aria-pressed={editMode ? isSelected : undefined}
            onClick={() => {
                if (editMode && canEdit === true)
                    onSelectService(service);
                else
                    onOpenService({ ...service, resolvedUrl: selectedEndpoint.url });
            }}
            onKeyDown={event => {
                if (event.key === 'Enter' || (editMode && event.key === ' ')) {
                    event.preventDefault();
                    if (editMode && canEdit === true)
                        onSelectService(service);
                    else if (event.key === 'Enter')
                        onOpenService({ ...service, resolvedUrl: selectedEndpoint.url });
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
                    <div
                        className="bookmark-card-actions"
                        onClick={event => {
                            event.stopPropagation();
                            if (editMode)
                                onSetSelectedBookmark(selectionKey);
                        }}
                        onKeyDown={event => event.stopPropagation()}
                    >
                        <ServiceActionMenu
                            service={service}
                            selectedEndpoint={selectedEndpoint}
                            editMode={editMode}
                            canEdit={canEdit}
                            saving={saving}
                            canMoveUp={canMoveUp}
                            canMoveDown={canMoveDown}
                            onOpenService={onOpenService}
                            onShowQr={() => onShowQr({
                                name: service.name || 'Service',
                                label: selectedEndpoint.label,
                                url: selectedEndpoint.url,
                                service: { ...service, resolvedUrl: selectedEndpoint.url },
                            })}
                            onEdit={() => onOpenEdit(service)}
                            onToggleFavorite={() => onToggleFavorite(service)}
                            onDuplicate={() => onDuplicateService(service)}
                            onMoveToGroup={() => onOpenMoveToGroup(service)}
                            onMoveWithinGroup={direction => onMoveWithinGroup(service, direction)}
                            onDelete={() => onRequestDelete(service)}
                        />
                    </div>
                </div>
            </CardTitle>
            <CardBody>
                {endpoints.length > 1 && (
                    <div
                        className="bookmark-endpoint-picker"
                        onClick={event => event.stopPropagation()}
                        onKeyDown={event => event.stopPropagation()}
                    >
                        <span>Address</span>
                        <SelectControl
                            value={endpointIndex}
                            ariaLabel={`Address for ${service.name || 'service'}`}
                            onChange={value => setEndpointIndex(Number(value))}
                            options={endpoints.map((endpoint, index) => ({ value: index, label: endpoint.label }))}
                        />
                    </div>
                )}
                <p className="bookmark-description">{service.description || selectedEndpoint.url}</p>
                <div className="bookmark-meta">
                    <span
                        className={`bookmark-service-status is-${serviceStatus.state}`}
                        title={serviceStatus.reason || `${statusLabel(serviceStatus)} from the Cockpit host`}
                        data-service-status-key={statusKey}
                    >
                        <span aria-hidden="true" />
                        {statusLabel(serviceStatus)}
                    </span>
                    {Array.isArray(service.tags) && service.tags.map(tag => (
                        <span className="bookmark-tag" key={tag}>{tag}</span>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}
