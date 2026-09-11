import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { normalizeAccent, serviceEndpoints, serviceGroup } from './bookmarks.js';
import { closeActionMenu, serviceSelectionKey } from './bookmark-ui.js';
import { checkServiceStatuses, summarizeServiceStatuses } from './service-status.js';

function serviceStatusKey(service) {
    return service.id ? `id:${service.id}` : `legacy-index:${service.sourceIndex}`;
}

function statusLabel(status) {
    if (status?.state === 'online')
        return status.endpointLabel && status.endpointLabel !== 'Primary' ? `Online · ${status.endpointLabel}` : 'Online';
    if (status?.state === 'offline')
        return 'Offline';
    return 'Unknown';
}

async function copyAddress(value) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
}

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
    const [endpointSelections, setEndpointSelections] = useState({});
    const [statuses, setStatuses] = useState({});
    const [statusRefreshing, setStatusRefreshing] = useState(false);
    const [qrTarget, setQrTarget] = useState(null);
    const [qrSvg, setQrSvg] = useState('');
    const [qrError, setQrError] = useState('');
    const hostname = window.location.hostname;

    const statusEntries = useMemo(() => configServices.map((service, index) => ({
        key: serviceStatusKey({ ...service, sourceIndex: index }),
        enabled: service.statusCheck !== false,
        endpoints: serviceEndpoints(service, hostname),
    })), [configServices, hostname]);
    const statusFingerprint = useMemo(
        () => JSON.stringify(statusEntries.map(entry => [entry.key, entry.enabled, entry.endpoints.map(endpoint => endpoint.url)])),
        [statusEntries]
    );

    const refreshStatuses = async () => {
        setStatusRefreshing(true);
        try {
            setStatuses(await checkServiceStatuses(window.cockpit, statusEntries));
        } finally {
            setStatusRefreshing(false);
        }
    };

    useEffect(() => {
        let active = true;
        setStatusRefreshing(true);
        checkServiceStatuses(window.cockpit, statusEntries)
            .then(result => {
                if (active)
                    setStatuses(result);
            })
            .finally(() => {
                if (active)
                    setStatusRefreshing(false);
            });
        return () => { active = false; };
    }, [statusFingerprint]);

    useEffect(() => {
        if (!qrTarget) {
            setQrSvg('');
            setQrError('');
            return;
        }
        let active = true;
        setQrSvg('');
        setQrError('');
        QRCode.toString(qrTarget.url, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 280,
        }).then(svg => {
            if (active)
                setQrSvg(svg);
        }).catch(error => {
            if (active)
                setQrError(error.message || 'Could not generate QR code.');
        });
        return () => { active = false; };
    }, [qrTarget]);

    const summary = summarizeServiceStatuses(statusEntries, statuses);

    return (
        <>
            <div className="bookmarks-service-summary" role="status" aria-live="polite">
                <span>
                    Services: <strong>{summary.online} online</strong> · {summary.offline} offline · {summary.unknown} unknown
                </span>
                <button type="button" onClick={refreshStatuses} disabled={statusRefreshing}>
                    {statusRefreshing ? 'Checking…' : 'Refresh'}
                </button>
            </div>

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
                                        const statusKey = serviceStatusKey(service);
                                        const isSelected = editMode && selectedBookmark === selectionKey;
                                        const isDragging = dragSource?.sourceIndex === service.sourceIndex;
                                        const opensSameTab = service.openMode === 'same-tab';
                                        const endpoints = serviceEndpoints(service, hostname);
                                        const requestedEndpointIndex = endpointSelections[statusKey] || 0;
                                        const endpointIndex = requestedEndpointIndex < endpoints.length ? requestedEndpointIndex : 0;
                                        const selectedEndpoint = endpoints[endpointIndex] || { label: 'Primary', url: service.resolvedUrl };
                                        const serviceStatus = statuses[statusKey] || { state: 'unknown' };
                                        const accent = normalizeAccent(service.accent);

                                        const chooseEndpoint = event => {
                                            event.stopPropagation();
                                            setEndpointSelections(current => ({
                                                ...current,
                                                [statusKey]: Number(event.target.value),
                                            }));
                                        };

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
                                                                            window.open(selectedEndpoint.url, '_blank', 'noopener,noreferrer');
                                                                        }}
                                                                    >
                                                                        Open in new tab
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="bookmark-action-menu-item"
                                                                        onClick={event => {
                                                                            closeActionMenu(event);
                                                                            copyAddress(selectedEndpoint.url).catch(() => {});
                                                                        }}
                                                                    >
                                                                        Copy URL
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="bookmark-action-menu-item"
                                                                        onClick={event => {
                                                                            closeActionMenu(event);
                                                                            setQrTarget({ name: service.name || 'Service', label: selectedEndpoint.label, url: selectedEndpoint.url });
                                                                        }}
                                                                    >
                                                                        Show QR code
                                                                    </button>
                                                                    {editMode && canEdit === true && (
                                                                        <>
                                                                            <div className="bookmark-action-menu-separator" />
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
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </details>
                                                        </div>
                                                    </div>
                                                </CardTitle>
                                                <CardBody>
                                                    {endpoints.length > 1 && (
                                                        <label
                                                            className="bookmark-endpoint-picker"
                                                            onClick={event => event.stopPropagation()}
                                                            onKeyDown={event => event.stopPropagation()}
                                                        >
                                                            <span>Address</span>
                                                            <select value={endpointIndex} onChange={chooseEndpoint}>
                                                                {endpoints.map((endpoint, index) => (
                                                                    <option value={index} key={`${endpoint.label}-${endpoint.url}`}>{endpoint.label}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    )}
                                                    <p className="bookmark-description">{service.description || selectedEndpoint.url}</p>
                                                    <div className="bookmark-meta">
                                                        <span
                                                            className={`bookmark-service-status is-${serviceStatus.state}`}
                                                            title={serviceStatus.reason || `${statusLabel(serviceStatus)} from the Cockpit host`}
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
                                    })}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>

            <Modal isOpen={qrTarget !== null} onClose={() => setQrTarget(null)} variant="small">
                <ModalHeader title={qrTarget ? `${qrTarget.name} QR code` : 'QR code'} />
                <ModalBody>
                    {qrTarget && (
                        <div className="bookmark-qr-dialog">
                            <div className="bookmark-qr-label">{qrTarget.label}</div>
                            {qrSvg && <div className="bookmark-qr-image" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
                            {qrError && <p>{qrError}</p>}
                            <code>{qrTarget.url}</code>
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    {qrTarget && (
                        <Button variant="primary" onClick={() => window.open(qrTarget.url, '_blank', 'noopener,noreferrer')}>
                            Open in new tab
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => setQrTarget(null)}>Close</Button>
                </ModalFooter>
            </Modal>
        </>
    );
}
