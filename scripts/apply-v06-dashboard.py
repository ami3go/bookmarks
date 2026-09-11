from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1))


# Extend the bookmark data model while keeping url as the primary/backward-compatible address.
replace_once('src/bookmarks.js',
"export const OPEN_MODES = ['new-tab', 'same-tab'];\n",
"export const OPEN_MODES = ['new-tab', 'same-tab'];\nexport const ACCENT_PRESETS = [\n    { value: 'none', label: 'Default' },\n    { value: 'blue', label: 'Blue' },\n    { value: 'green', label: 'Green' },\n    { value: 'teal', label: 'Teal' },\n    { value: 'purple', label: 'Purple' },\n    { value: 'orange', label: 'Orange' },\n    { value: 'red', label: 'Red' },\n];\n")

replace_once('src/bookmarks.js',
"export const EMPTY_BOOKMARK = {\n    name: '',\n    url: '',\n    description: '',\n    group: '',\n    icon: '',\n    tags: '',\n    openMode: 'new-tab',\n};\n\nexport const ICON_PRESETS = ['🔗', '📊', '🖥️', '📦', '🗄️', '🌐', '🛠️', '📁', '🔒', '🎛️'];\n",
"export const EMPTY_BOOKMARK = {\n    name: '',\n    url: '',\n    endpoints: '',\n    description: '',\n    group: '',\n    icon: '',\n    accent: 'none',\n    tags: '',\n    openMode: 'new-tab',\n    statusCheck: true,\n};\n\nexport const ICON_PRESETS = [\n    '🔗', '🌐', '🖥️', '📊', '📈', '📦', '🗄️', '💾', '📁', '🔒',\n    '🛠️', '🎛️', '⚙️', '🏠', '☁️', '🧭', '🧪', '📡', '🎥', '🎵',\n];\n")

allowed_block = """export function allowedUrl(url) {\n    const value = String(url || '').trim();\n    if (!/^https?:\\/\\//i.test(value))\n        return false;\n\n    try {\n        const parsed = new URL(value);\n        return parsed.protocol === 'http:' || parsed.protocol === 'https:';\n    } catch (_) {\n        return false;\n    }\n}\n"""
endpoint_helpers = allowed_block + """\nexport function normalizeAccent(value) {\n    const normalized = String(value || 'none').trim().toLowerCase();\n    return ACCENT_PRESETS.some(option => option.value === normalized) ? normalized : 'none';\n}\n\nexport function normalizeEndpoints(value) {\n    if (!Array.isArray(value))\n        return [];\n\n    const result = [];\n    const seen = new Set();\n    value.forEach((entry, index) => {\n        const endpoint = typeof entry === 'string'\n            ? { label: `Address ${index + 1}`, url: entry }\n            : entry;\n        if (!endpoint || typeof endpoint !== 'object')\n            return;\n        const url = String(endpoint.url || '').trim();\n        if (!url)\n            return;\n        const key = url.toLowerCase();\n        if (seen.has(key))\n            return;\n        seen.add(key);\n        result.push({\n            label: String(endpoint.label || `Address ${index + 1}`).trim() || `Address ${index + 1}`,\n            url,\n        });\n    });\n    return result;\n}\n\nexport function parseEndpointDraft(value) {\n    return String(value || '')\n        .split(/\\r?\\n/)\n        .map(line => line.trim())\n        .filter(Boolean)\n        .map((line, index) => {\n            const separator = line.indexOf('|');\n            if (separator === -1)\n                return { label: `Address ${index + 1}`, url: line.trim() };\n            const label = line.slice(0, separator).trim() || `Address ${index + 1}`;\n            const url = line.slice(separator + 1).trim();\n            return { label, url };\n        });\n}\n\nexport function formatEndpointDraft(value) {\n    return normalizeEndpoints(value)\n        .map(endpoint => `${endpoint.label} | ${endpoint.url}`)\n        .join('\\n');\n}\n\nexport function serviceEndpoints(service, hostname) {\n    const raw = [\n        { label: 'Primary', url: String(service?.url || '').trim() },\n        ...normalizeEndpoints(service?.endpoints),\n    ];\n    const seen = new Set();\n    return raw\n        .map((endpoint, index) => ({\n            label: endpoint.label || (index === 0 ? 'Primary' : `Address ${index}`),\n            url: expandUrl(endpoint.url, hostname),\n            primary: index === 0,\n        }))\n        .filter(endpoint => allowedUrl(endpoint.url))\n        .filter(endpoint => {\n            const key = endpoint.url.toLowerCase();\n            if (seen.has(key))\n                return false;\n            seen.add(key);\n            return true;\n        });\n}\n"""
replace_once('src/bookmarks.js', allowed_block, endpoint_helpers)

replace_once('src/bookmarks.js',
"""export function editableBookmark(service = EMPTY_BOOKMARK) {\n    return {\n        name: String(service.name || ''),\n        url: String(service.url || ''),\n        description: String(service.description || ''),\n        group: String(service.group || ''),\n        icon: String(service.icon || ''),\n        tags: tagsArray(service.tags).join(', '),\n        openMode: normalizeOpenMode(service.openMode),\n    };\n}\n""",
"""export function editableBookmark(service = EMPTY_BOOKMARK) {\n    return {\n        name: String(service.name || ''),\n        url: String(service.url || ''),\n        endpoints: formatEndpointDraft(service.endpoints),\n        description: String(service.description || ''),\n        group: String(service.group || ''),\n        icon: String(service.icon || ''),\n        accent: normalizeAccent(service.accent),\n        tags: tagsArray(service.tags).join(', '),\n        openMode: normalizeOpenMode(service.openMode),\n        statusCheck: service.statusCheck !== false,\n    };\n}\n""")

replace_once('src/bookmarks.js',
"""    const tags = tagsArray(draft.tags);\n    if (tags.length)\n        bookmark.tags = tags;\n    else\n        delete bookmark.tags;\n\n    const openMode = normalizeOpenMode(draft.openMode);\n""",
"""    const endpoints = normalizeEndpoints(parseEndpointDraft(draft.endpoints));\n    if (endpoints.length)\n        bookmark.endpoints = endpoints;\n    else\n        delete bookmark.endpoints;\n\n    const accent = normalizeAccent(draft.accent);\n    if (accent !== 'none')\n        bookmark.accent = accent;\n    else\n        delete bookmark.accent;\n\n    if (draft.statusCheck === false)\n        bookmark.statusCheck = false;\n    else\n        delete bookmark.statusCheck;\n\n    const tags = tagsArray(draft.tags);\n    if (tags.length)\n        bookmark.tags = tags;\n    else\n        delete bookmark.tags;\n\n    const openMode = normalizeOpenMode(draft.openMode);\n""")

replace_once('src/bookmarks.js',
"""function comparableService(service) {\n    return {\n        name: String(service?.name || ''),\n        url: String(service?.url || ''),\n        description: String(service?.description || ''),\n        group: String(service?.group || ''),\n        icon: String(service?.icon || ''),\n        tags: tagsArray(service?.tags).map(tag => tag.toLowerCase()).sort(),\n        favorite: service?.favorite === true,\n        openMode: normalizeOpenMode(service?.openMode),\n    };\n}\n""",
"""function comparableService(service) {\n    return {\n        name: String(service?.name || ''),\n        url: String(service?.url || ''),\n        endpoints: normalizeEndpoints(service?.endpoints),\n        description: String(service?.description || ''),\n        group: String(service?.group || ''),\n        icon: String(service?.icon || ''),\n        accent: normalizeAccent(service?.accent),\n        tags: tagsArray(service?.tags).map(tag => tag.toLowerCase()).sort(),\n        favorite: service?.favorite === true,\n        openMode: normalizeOpenMode(service?.openMode),\n        statusCheck: service?.statusCheck !== false,\n    };\n}\n""")

replace_once('src/bookmarks.js',
"""export function validateBookmark(draft, hostname) {\n    const errors = {};\n    const name = String(draft.name || '').trim();\n    const url = String(draft.url || '').trim();\n\n    if (!name)\n        errors.name = 'Name is required.';\n\n    if (!url)\n        errors.url = 'URL is required.';\n    else if (!allowedUrl(expandUrl(url, hostname)))\n        errors.url = 'Use a complete http:// or https:// URL. The {host} placeholder is supported.';\n\n    return errors;\n}\n""",
"""export function validateBookmark(draft, hostname) {\n    const errors = {};\n    const name = String(draft.name || '').trim();\n    const url = String(draft.url || '').trim();\n\n    if (!name)\n        errors.name = 'Name is required.';\n\n    if (!url)\n        errors.url = 'URL is required.';\n    else if (!allowedUrl(expandUrl(url, hostname)))\n        errors.url = 'Use a complete http:// or https:// URL. The {host} placeholder is supported.';\n\n    const endpoints = parseEndpointDraft(draft.endpoints);\n    const invalidEndpoint = endpoints.findIndex(endpoint => !endpoint.url || !allowedUrl(expandUrl(endpoint.url, hostname)));\n    if (invalidEndpoint !== -1)\n        errors.endpoints = `Alternate address ${invalidEndpoint + 1} must use a complete http:// or https:// URL.`;\n\n    return errors;\n}\n""")

# Extend the bookmark editor.
replace_once('src/management-dialogs.jsx',
"""    CONFIG_PATH,\n    DISPLAY_MODES,\n    ICON_PRESETS,\n""",
"""    ACCENT_PRESETS,\n    CONFIG_PATH,\n    DISPLAY_MODES,\n    ICON_PRESETS,\n""")

url_group = """                        <FormGroup label=\"URL\" isRequired fieldId=\"bookmark-url\">\n                            <TextInput\n                                id=\"bookmark-url\"\n                                value={draft.url}\n                                onChange={(_event, value) => updateDraft('url', value)}\n                                placeholder=\"http://{host}:3000\"\n                                isRequired\n                                validated={formErrors.url ? 'error' : 'default'}\n                            />\n                            {formErrors.url && <div className=\"bookmark-field-error\">{formErrors.url}</div>}\n                            {!formErrors.url && (\n                                <div className=\"bookmark-field-help\">\n                                    Use <code>{'{host}'}</code> for the Cockpit host name or IP address.\n                                    {resolvedPreview && allowedUrl(resolvedPreview) && (\n                                        <div>Resolved URL: <code>{resolvedPreview}</code></div>\n                                    )}\n                                </div>\n                            )}\n                        </FormGroup>\n"""
replace_once('src/management-dialogs.jsx', url_group, url_group + """                        <FormGroup label=\"Alternate addresses\" fieldId=\"bookmark-endpoints\">\n                            <TextArea\n                                id=\"bookmark-endpoints\"\n                                value={draft.endpoints}\n                                onChange={(_event, value) => updateDraft('endpoints', value)}\n                                placeholder={'LAN | http://192.168.1.20:3000\\nRemote | https://grafana.example.com'}\n                                resizeOrientation=\"vertical\"\n                                validated={formErrors.endpoints ? 'error' : 'default'}\n                            />\n                            {formErrors.endpoints && <div className=\"bookmark-field-error\">{formErrors.endpoints}</div>}\n                            <div className=\"bookmark-field-help\">\n                                Optional. Add one address per line as <code>Label | URL</code>. The primary URL remains the default.\n                            </div>\n                        </FormGroup>\n""")

open_group = """                        <FormGroup label=\"Open behavior\" fieldId=\"bookmark-open-mode\">\n                            <select\n                                id=\"bookmark-open-mode\"\n                                className=\"bookmark-select\"\n                                value={draft.openMode}\n                                onChange={event => updateDraft('openMode', event.target.value)}\n                            >\n                                {OPEN_MODES.map(mode => (\n                                    <option value={mode} key={mode}>\n                                        {mode === 'same-tab' ? 'Same tab' : 'New tab'}\n                                    </option>\n                                ))}\n                            </select>\n                            <div className=\"bookmark-field-help\">New tab is the default for existing bookmarks.</div>\n                        </FormGroup>\n"""
replace_once('src/management-dialogs.jsx', open_group, open_group + """                        <FormGroup label=\"Availability\" fieldId=\"bookmark-status-check\">\n                            <label className=\"bookmarks-checkbox\">\n                                <input\n                                    id=\"bookmark-status-check\"\n                                    type=\"checkbox\"\n                                    checked={draft.statusCheck !== false}\n                                    onChange={event => updateDraft('statusCheck', event.target.checked)}\n                                />\n                                <span>Check whether this service is reachable from the Cockpit host</span>\n                            </label>\n                            <div className=\"bookmark-field-help\">Checks TCP reachability of the primary and alternate addresses. No HTTP credentials are sent.</div>\n                        </FormGroup>\n""")

icon_group_end = """                            </div>\n                        </FormGroup>\n                        <FormGroup label=\"Tags\" fieldId=\"bookmark-tags\">\n"""
replace_once('src/management-dialogs.jsx', icon_group_end,
"""                            </div>\n                        </FormGroup>\n                        <FormGroup label=\"Card accent\" fieldId=\"bookmark-accent\">\n                            <div className=\"bookmark-accent-presets\" aria-label=\"Card accent presets\">\n                                {ACCENT_PRESETS.map(option => (\n                                    <button\n                                        type=\"button\"\n                                        className={`bookmark-accent-choice accent-${option.value}${draft.accent === option.value ? ' is-selected' : ''}`}\n                                        onClick={() => updateDraft('accent', option.value)}\n                                        aria-label={`Use ${option.label} card accent`}\n                                        title={option.label}\n                                        key={option.value}\n                                    >\n                                        <span aria-hidden=\"true\" />\n                                        {option.label}\n                                    </button>\n                                ))}\n                            </div>\n                        </FormGroup>\n                        <FormGroup label=\"Tags\" fieldId=\"bookmark-tags\">\n""")

# Replace card rendering with integrated endpoint selection, status, user actions, QR, and accents.
Path('src/bookmark-sections.jsx').write_text(r'''import React, { useEffect, useMemo, useState } from 'react';
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
''')

Path('src/bookmark-sections.css').write_text(r'''.bookmark-group-order-actions {
    display: flex;
    gap: 0.15rem;
    margin-left: auto;
}

.bookmarks-service-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 1rem;
    padding: 0.45rem 0.75rem;
    border-block: 1px solid var(--pf-t--global--border--color--default, rgba(127, 127, 127, 0.35));
    font-size: 0.82rem;
}

.bookmarks-service-summary button {
    padding: 0;
    color: var(--pf-t--global--text--color--link--default, #06c);
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    text-decoration: underline;
}

.bookmarks-service-summary button:disabled {
    cursor: default;
    opacity: 0.55;
}

.bookmarks-grid.is-compact {
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.65rem;
}

.bookmark-card.is-compact .pf-v6-c-card__title {
    padding: 0.65rem 0.75rem 0.35rem;
}

.bookmark-card.is-compact .pf-v6-c-card__body {
    padding: 0 0.75rem 0.65rem;
}

.bookmark-card.is-compact .bookmark-icon {
    width: 1.5rem;
    height: 1.5rem;
    margin-right: 0.45rem;
    font-size: 1rem;
}

.bookmark-card.is-compact .bookmark-description {
    overflow: hidden;
    font-size: 0.82rem;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bookmark-card.is-compact .bookmark-meta {
    margin-top: 0.5rem;
}

.bookmark-card.bookmark-accent-blue { box-shadow: inset 4px 0 var(--pf-t--global--color--brand--default, #06c); }
.bookmark-card.bookmark-accent-green { box-shadow: inset 4px 0 var(--pf-t--global--color--status--success--default, #3e8635); }
.bookmark-card.bookmark-accent-teal { box-shadow: inset 4px 0 #009596; }
.bookmark-card.bookmark-accent-purple { box-shadow: inset 4px 0 #6753ac; }
.bookmark-card.bookmark-accent-orange { box-shadow: inset 4px 0 var(--pf-t--global--color--status--warning--default, #f0ab00); }
.bookmark-card.bookmark-accent-red { box-shadow: inset 4px 0 var(--pf-t--global--color--status--danger--default, #c9190b); }

.bookmark-endpoint-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.55rem;
    font-size: 0.75rem;
}

.bookmark-endpoint-picker span {
    opacity: 0.65;
}

.bookmark-endpoint-picker select {
    min-width: 0;
    max-width: 12rem;
    padding: 0.15rem 1.5rem 0.15rem 0.35rem;
    color: inherit;
    background: transparent;
    border: 1px solid currentcolor;
    border-radius: 3px;
    font: inherit;
}

.bookmark-service-status {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    opacity: 0.8;
}

.bookmark-service-status > span {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: currentcolor;
}

.bookmark-service-status.is-online { color: var(--pf-t--global--text--color--status--success--default, #3e8635); }
.bookmark-service-status.is-offline { color: var(--pf-t--global--text--color--status--danger--default, #c9190b); }
.bookmark-service-status.is-unknown { opacity: 0.55; }

.bookmark-accent-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.bookmark-accent-choice {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.5rem;
    color: inherit;
    background: transparent;
    border: 1px solid currentcolor;
    border-radius: 4px;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
    opacity: 0.72;
}

.bookmark-accent-choice > span {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 2px;
    background: currentcolor;
}

.bookmark-accent-choice.accent-none > span { background: transparent; border: 1px solid currentcolor; }
.bookmark-accent-choice.accent-blue > span { color: #06c; }
.bookmark-accent-choice.accent-green > span { color: #3e8635; }
.bookmark-accent-choice.accent-teal > span { color: #009596; }
.bookmark-accent-choice.accent-purple > span { color: #6753ac; }
.bookmark-accent-choice.accent-orange > span { color: #f0ab00; }
.bookmark-accent-choice.accent-red > span { color: #c9190b; }
.bookmark-accent-choice:hover,
.bookmark-accent-choice:focus-visible,
.bookmark-accent-choice.is-selected { opacity: 1; }
.bookmark-accent-choice.is-selected { outline: 2px solid currentcolor; outline-offset: 1px; }

.bookmark-qr-dialog {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    text-align: center;
}

.bookmark-qr-label {
    font-weight: 700;
}

.bookmark-qr-image {
    width: min(17.5rem, 100%);
    padding: 0.5rem;
    background: white;
    border-radius: 6px;
}

.bookmark-qr-image svg {
    display: block;
    width: 100%;
    height: auto;
}

.bookmark-qr-dialog code {
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: normal;
}

@media (max-width: 36rem) {
    .bookmarks-service-summary {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.35rem;
    }
}
''')

# Add model/status tests without disturbing the existing test file.
Path('tests/dashboard-features.test.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';

import {
    editableBookmark,
    formatEndpointDraft,
    normalizeAccent,
    normalizeEndpoints,
    parseEndpointDraft,
    serviceEndpoints,
    storedBookmark,
    validateBookmark,
} from '../src/bookmarks.js';

test('normalizes endpoint arrays and formats editor lines', () => {
    const endpoints = normalizeEndpoints([
        { label: 'LAN', url: 'http://192.168.1.20:3000' },
        'https://remote.test',
        { label: 'Duplicate', url: 'https://remote.test' },
    ]);
    assert.deepEqual(endpoints, [
        { label: 'LAN', url: 'http://192.168.1.20:3000' },
        { label: 'Address 2', url: 'https://remote.test' },
    ]);
    assert.equal(formatEndpointDraft(endpoints), 'LAN | http://192.168.1.20:3000\nAddress 2 | https://remote.test');
});

test('parses alternate address editor syntax and resolves host placeholders', () => {
    const parsed = parseEndpointDraft('LAN | http://{host}:3000\nhttps://remote.test');
    assert.deepEqual(parsed, [
        { label: 'LAN', url: 'http://{host}:3000' },
        { label: 'Address 2', url: 'https://remote.test' },
    ]);
    assert.deepEqual(serviceEndpoints({
        url: 'http://{host}:8080',
        endpoints: parsed,
    }, 'mini-pc.local').map(endpoint => endpoint.url), [
        'http://mini-pc.local:8080',
        'http://mini-pc.local:3000',
        'https://remote.test/',
    ]);
});

test('stores optional endpoints, accent, and disabled status checking', () => {
    const stored = storedBookmark({
        name: 'Grafana',
        url: 'http://{host}:3000',
        endpoints: 'LAN | http://192.168.1.20:3000',
        accent: 'purple',
        statusCheck: false,
        tags: '',
        openMode: 'new-tab',
    });
    assert.deepEqual(stored.endpoints, [{ label: 'LAN', url: 'http://192.168.1.20:3000' }]);
    assert.equal(stored.accent, 'purple');
    assert.equal(stored.statusCheck, false);
    const editable = editableBookmark(stored);
    assert.equal(editable.endpoints, 'LAN | http://192.168.1.20:3000');
    assert.equal(editable.accent, 'purple');
    assert.equal(editable.statusCheck, false);
});

test('uses theme-safe accent presets and validates alternate addresses', () => {
    assert.equal(normalizeAccent('teal'), 'teal');
    assert.equal(normalizeAccent('hotpink'), 'none');
    assert.deepEqual(validateBookmark({
        name: 'Good',
        url: 'http://{host}:8080',
        endpoints: 'LAN | http://192.168.1.10:8080',
    }, 'mini-pc'), {});
    assert.ok(validateBookmark({
        name: 'Bad alternate',
        url: 'http://{host}:8080',
        endpoints: 'LAN | ssh://192.168.1.10',
    }, 'mini-pc').endpoints);
});
''')

# Document the user-facing feature set.
replace_once('CHANGELOG.md',
"## [Unreleased]\n\n### Packaging\n",
"## [Unreleased]\n\n### Added\n\n- Host-side TCP availability indicators for bookmarks, with bounded checks on page load and a manual refresh summary.\n- Multiple addresses per bookmark while keeping the existing URL as the primary/default address.\n- User card actions outside Edit mode: Open in new tab, Copy URL, and locally generated QR code.\n- Dashboard service summary showing online, offline, and unknown counts.\n- Expanded icon presets and optional theme-safe card accent presets.\n\n### Packaging\n")

replace_once('README.md',
"- per-bookmark open behavior: new tab or same tab\n- `{host}` substitution for the Cockpit host name/IP address\n",
"- per-bookmark open behavior: new tab or same tab, with new tab as the default\n- multiple addresses per bookmark with a selectable primary/LAN/remote endpoint\n- host-side service reachability indicators plus an online/offline/unknown summary\n- user card menu with Open in new tab, Copy URL, and locally generated QR code\n- expanded icon presets and optional card accent presets\n- `{host}` substitution for the Cockpit host name/IP address\n")

replace_once('README.md',
"- `url` — required absolute `http://` or `https://` URL\n- `description` — optional secondary text\n",
"- `url` — required primary absolute `http://` or `https://` URL\n- `endpoints` — optional array of additional `{ label, url }` addresses; the primary `url` remains the default\n- `description` — optional secondary text\n")

replace_once('README.md',
"- `icon` — optional emoji or text icon\n- `tags` — optional searchable metadata stored as an array\n",
"- `icon` — optional emoji or text icon\n- `accent` — optional theme-safe card accent preset (`blue`, `green`, `teal`, `purple`, `orange`, or `red`)\n- `statusCheck` — optional boolean; defaults to enabled and can disable host-side reachability checks for a bookmark\n- `tags` — optional searchable metadata stored as an array\n")
