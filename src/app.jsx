import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { Page } from '@patternfly/react-core/dist/esm/components/Page/index.js';
import { SearchInput } from '@patternfly/react-core/dist/esm/components/SearchInput/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

const CONFIG_PATH = '/etc/cockpit/cockpit-bookmarks.json';
const DEFAULT_CONFIG = {
    title: 'Cockpit Bookmarks',
    subtitle: 'Services hosted on this mini PC',
    services: [],
};
const EMPTY_BOOKMARK = {
    name: '',
    url: '',
    description: '',
    group: '',
    icon: '',
};
const CONFIG_SYNTAX = {
    parse: JSON.parse,
    stringify: value => `${JSON.stringify(value, null, 2)}\n`,
};

function PencilIcon() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            focusable="false"
            fill="currentColor"
        >
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a.996.996 0 0 0 0-1.41l-2.5-2.5a.996.996 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-1.8Z" />
        </svg>
    );
}

function miniPcHost() {
    const hostname = window.location.hostname;
    return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}

function expandUrl(url) {
    return String(url || '').replaceAll('{host}', miniPcHost());
}

function allowedUrl(url) {
    try {
        const parsed = new URL(url, window.location.href);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function normalizeConfig(config) {
    if (!config || typeof config !== 'object' || !Array.isArray(config.services))
        throw new Error('Configuration must contain a services array.');

    return {
        ...config,
        title: config.title || DEFAULT_CONFIG.title,
        subtitle: config.subtitle || DEFAULT_CONFIG.subtitle,
        services: config.services,
    };
}

function newBookmarkId() {
    if (window.crypto?.randomUUID)
        return window.crypto.randomUUID();

    return `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function editableBookmark(service = EMPTY_BOOKMARK) {
    return {
        name: String(service.name || ''),
        url: String(service.url || ''),
        description: String(service.description || ''),
        group: String(service.group || ''),
        icon: String(service.icon || ''),
    };
}

function storedBookmark(draft, original = {}) {
    const bookmark = {
        ...original,
        id: original.id || newBookmarkId(),
        name: draft.name.trim(),
        url: draft.url.trim(),
    };

    for (const field of ['description', 'group', 'icon']) {
        const value = draft[field].trim();
        if (value)
            bookmark[field] = value;
        else
            delete bookmark[field];
    }

    return bookmark;
}

function sameLegacyBookmark(left, right) {
    return ['name', 'url', 'description', 'group', 'icon'].every(field =>
        String(left?.[field] || '') === String(right?.[field] || ''));
}

function findBookmarkIndex(services, target) {
    if (target.service.id) {
        const byId = services.findIndex(service => service.id === target.service.id);
        if (byId !== -1)
            return byId;
    }

    if (target.index >= 0 && target.index < services.length &&
        sameLegacyBookmark(services[target.index], target.service))
        return target.index;

    return services.findIndex(service => sameLegacyBookmark(service, target.service));
}

function validateBookmark(draft) {
    const errors = {};

    if (!draft.name.trim())
        errors.name = 'Name is required.';

    if (!draft.url.trim())
        errors.url = 'URL is required.';
    else if (!allowedUrl(expandUrl(draft.url.trim())))
        errors.url = 'Use an http:// or https:// URL. The {host} placeholder is supported.';

    return errors;
}

export const Application = () => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [query, setQuery] = useState('');
    const [notice, setNotice] = useState(null);
    const [canEdit, setCanEdit] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editor, setEditor] = useState(null);
    const [draft, setDraft] = useState(EMPTY_BOOKMARK);
    const [formErrors, setFormErrors] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const file = window.cockpit.file(CONFIG_PATH, { syntax: CONFIG_SYNTAX, max_read_size: 262144 });
        let active = true;

        file.read()
            .then(content => {
                if (!active)
                    return;

                if (content === null) {
                    setNotice({
                        variant: 'info',
                        text: `No configuration found. Add a bookmark to create ${CONFIG_PATH}.`,
                    });
                    return;
                }

                setConfig(normalizeConfig(content));
            })
            .catch(error => {
                if (!active)
                    return;
                setNotice({
                    variant: 'danger',
                    text: `Could not load ${CONFIG_PATH}: ${window.cockpit.message(error)}`,
                });
            });

        return () => {
            active = false;
            file.close();
        };
    }, []);

    useEffect(() => {
        const permission = window.cockpit.permission({ admin: true });
        const updatePermission = () => {
            setCanEdit(permission.allowed);
            if (!permission.allowed)
                setEditMode(false);
        };

        updatePermission();
        permission.addEventListener('changed', updatePermission);

        return () => {
            permission.removeEventListener('changed', updatePermission);
            permission.close();
        };
    }, []);

    const services = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return config.services
            .map((service, index) => ({ ...service, sourceIndex: index, resolvedUrl: expandUrl(service.url) }))
            .filter(service => allowedUrl(service.resolvedUrl))
            .filter(service => {
                if (!needle)
                    return true;
                const haystack = `${service.name || ''} ${service.description || ''} ${service.group || ''} ${service.url || ''}`.toLowerCase();
                return haystack.includes(needle);
            });
    }, [config.services, query]);

    const modifyConfig = (transform, successText, onSuccess) => {
        const file = window.cockpit.file(CONFIG_PATH, {
            syntax: CONFIG_SYNTAX,
            max_read_size: 262144,
            superuser: 'require',
        });

        setSaving(true);
        setNotice(null);

        file.modify(oldContent => {
            const current = oldContent === null
                ? { ...DEFAULT_CONFIG, services: [] }
                : normalizeConfig(oldContent);
            return transform(current);
        })
            .then(newContent => {
                file.close();
                setSaving(false);
                setConfig(normalizeConfig(newContent));
                setNotice({ variant: 'success', text: successText });
                onSuccess?.();
            })
            .catch(error => {
                file.close();
                setSaving(false);
                setNotice({
                    variant: 'danger',
                    text: `Could not update ${CONFIG_PATH}: ${window.cockpit.message(error)}`,
                });
            });
    };

    const openAdd = () => {
        setDraft({ ...EMPTY_BOOKMARK });
        setFormErrors({});
        setEditor({ mode: 'add' });
    };

    const openEdit = service => {
        if (!editMode || canEdit !== true)
            return;

        const { sourceIndex, resolvedUrl, ...storedService } = service;
        setDraft(editableBookmark(storedService));
        setFormErrors({});
        setEditor({
            mode: 'edit',
            target: { index: sourceIndex, service: storedService },
        });
    };

    const closeEditor = () => {
        if (!saving) {
            setEditor(null);
            setFormErrors({});
        }
    };

    const updateDraft = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
        setFormErrors(current => ({ ...current, [field]: undefined }));
    };

    const submitEditor = event => {
        event.preventDefault();
        const errors = validateBookmark(draft);
        setFormErrors(errors);
        if (Object.keys(errors).length > 0)
            return;

        if (editor.mode === 'add') {
            modifyConfig(current => ({
                ...current,
                services: [...current.services, storedBookmark(draft)],
            }), 'Bookmark added.', () => setEditor(null));
            return;
        }

        modifyConfig(current => {
            const index = findBookmarkIndex(current.services, editor.target);
            if (index === -1)
                throw new Error('This bookmark was changed or removed. Reload the page and try again.');

            const services = [...current.services];
            services[index] = storedBookmark(draft, services[index]);
            return { ...current, services };
        }, 'Bookmark updated.', () => setEditor(null));
    };

    const requestDelete = service => {
        if (!editMode || canEdit !== true)
            return;

        const { sourceIndex, resolvedUrl, ...storedService } = service;
        setDeleteTarget({ index: sourceIndex, service: storedService });
    };

    const deleteBookmark = () => {
        modifyConfig(current => {
            const index = findBookmarkIndex(current.services, deleteTarget);
            if (index === -1)
                throw new Error('This bookmark was changed or removed. Reload the page and try again.');

            return {
                ...current,
                services: current.services.filter((_, serviceIndex) => serviceIndex !== index),
            };
        }, 'Bookmark deleted.', () => setDeleteTarget(null));
    };

    const openService = service => {
        window.open(service.resolvedUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <Page className="pf-m-no-sidebar">
            <main className="bookmarks-page">
                <header className="bookmarks-header">
                    <div>
                        <p className="bookmarks-eyebrow">Mini PC</p>
                        <h1>{config.title}</h1>
                        <p className="bookmarks-subtitle">{config.subtitle}</p>
                    </div>
                    <div className="bookmarks-header-actions">
                        <SearchInput
                            aria-label="Search bookmarks"
                            placeholder="Search bookmarks…"
                            value={query}
                            onChange={(_event, value) => setQuery(value)}
                            onClear={() => setQuery('')}
                        />
                        <Button
                            variant="primary"
                            onClick={openAdd}
                            isDisabled={canEdit !== true}
                        >
                            Add bookmark
                        </Button>
                        <Button
                            variant={editMode ? 'secondary' : 'plain'}
                            className="bookmark-edit-mode-toggle"
                            onClick={() => setEditMode(current => !current)}
                            isDisabled={canEdit !== true}
                            aria-label={editMode ? 'Disable edit mode' : 'Enable edit mode'}
                            aria-pressed={editMode}
                            title={editMode ? 'Disable edit mode' : 'Enable edit mode'}
                        >
                            <PencilIcon />
                        </Button>
                    </div>
                </header>

                {canEdit === false && (
                    <Alert
                        isInline
                        variant="info"
                        title="Read-only mode"
                        className="bookmarks-notice"
                    >
                        Administrator privileges are required to add, edit, or delete bookmarks.
                    </Alert>
                )}

                {notice && (
                    <Alert
                        isInline
                        variant={notice.variant}
                        title={notice.text}
                        className="bookmarks-notice"
                    />
                )}

                {services.length > 0 ? (
                    <section className="bookmarks-grid" aria-label="Service bookmarks">
                        {services.map(service => (
                            <Card
                                className="bookmark-card"
                                key={service.id || `${service.sourceIndex}-${service.resolvedUrl}`}
                                role="link"
                                tabIndex={0}
                                aria-label={`Open ${service.name || 'service'} in a new tab`}
                                onClick={() => openService(service)}
                                onKeyDown={event => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        openService(service);
                                    }
                                }}
                            >
                                <CardTitle>
                                    <div className="bookmark-title-row">
                                        <div className="bookmark-title-main">
                                            <span className="bookmark-icon" aria-hidden="true">{service.icon || '↗'}</span>
                                            <span>{service.name || 'Unnamed service'}</span>
                                        </div>
                                        {canEdit === true && (
                                            <div
                                                className="bookmark-card-actions"
                                                onClick={event => event.stopPropagation()}
                                                onKeyDown={event => event.stopPropagation()}
                                            >
                                                <Button
                                                    variant="link"
                                                    isInline
                                                    isDisabled={!editMode || saving}
                                                    onClick={() => openEdit(service)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="link"
                                                    isDanger
                                                    isInline
                                                    isDisabled={!editMode || saving}
                                                    onClick={() => requestDelete(service)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardTitle>
                                <CardBody>
                                    <p className="bookmark-description">{service.description || service.resolvedUrl}</p>
                                    {service.group && (
                                        <div className="bookmark-meta">
                                            <span className="bookmark-group">{service.group}</span>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        ))}
                    </section>
                ) : (
                    <div className="bookmarks-empty">
                        <p>No matching services.</p>
                        {canEdit === true && !query && (
                            <Button variant="primary" onClick={openAdd}>Add your first bookmark</Button>
                        )}
                    </div>
                )}

                <footer className="bookmarks-footer">
                    Configuration: <code>{CONFIG_PATH}</code>
                </footer>
            </main>

            <Modal
                isOpen={editor !== null}
                onClose={closeEditor}
                variant="medium"
            >
                <ModalHeader title={editor?.mode === 'edit' ? 'Edit bookmark' : 'Add bookmark'} />
                <ModalBody>
                    <Form id="bookmark-editor-form" onSubmit={submitEditor}>
                        <FormGroup label="Name" isRequired fieldId="bookmark-name">
                            <TextInput
                                id="bookmark-name"
                                value={draft.name}
                                onChange={(_event, value) => updateDraft('name', value)}
                                isRequired
                                validated={formErrors.name ? 'error' : 'default'}
                            />
                            {formErrors.name && <div className="bookmark-field-error">{formErrors.name}</div>}
                        </FormGroup>
                        <FormGroup label="URL" isRequired fieldId="bookmark-url">
                            <TextInput
                                id="bookmark-url"
                                value={draft.url}
                                onChange={(_event, value) => updateDraft('url', value)}
                                placeholder="http://{host}:3000"
                                isRequired
                                validated={formErrors.url ? 'error' : 'default'}
                            />
                            {formErrors.url && <div className="bookmark-field-error">{formErrors.url}</div>}
                            {!formErrors.url && <div className="bookmark-field-help">Use {'{host}'} for the Cockpit host name or IP address.</div>}
                        </FormGroup>
                        <FormGroup label="Description" fieldId="bookmark-description">
                            <TextArea
                                id="bookmark-description"
                                value={draft.description}
                                onChange={(_event, value) => updateDraft('description', value)}
                                resizeOrientation="vertical"
                            />
                        </FormGroup>
                        <FormGroup label="Group" fieldId="bookmark-group">
                            <TextInput
                                id="bookmark-group"
                                value={draft.group}
                                onChange={(_event, value) => updateDraft('group', value)}
                                placeholder="Monitoring"
                            />
                        </FormGroup>
                        <FormGroup label="Icon" fieldId="bookmark-icon">
                            <TextInput
                                id="bookmark-icon"
                                value={draft.icon}
                                onChange={(_event, value) => updateDraft('icon', value)}
                                placeholder="📊"
                            />
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="primary"
                        type="submit"
                        form="bookmark-editor-form"
                        isDisabled={saving}
                    >
                        {saving ? 'Saving…' : (editor?.mode === 'edit' ? 'Save changes' : 'Add bookmark')}
                    </Button>
                    <Button variant="link" onClick={closeEditor} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal
                isOpen={deleteTarget !== null}
                onClose={() => !saving && setDeleteTarget(null)}
                variant="small"
            >
                <ModalHeader title="Delete bookmark?" titleIconVariant="danger" />
                <ModalBody>
                    {deleteTarget && (
                        <p>
                            Delete <strong>{deleteTarget.service.name || 'this bookmark'}</strong>? This removes it from {CONFIG_PATH}.
                        </p>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="danger" onClick={deleteBookmark} isDisabled={saving}>
                        {saving ? 'Deleting…' : 'Delete'}
                    </Button>
                    <Button variant="link" onClick={() => setDeleteTarget(null)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>
        </Page>
    );
};
