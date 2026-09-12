import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import { modifyConfiguration, readConfiguration } from './cockpit-config.js';
import {
    GOTTY_LAUNCHER_TYPE,
    buildLauncherService,
    isNetworkExposedAddress,
    launcherDraft,
    stopGoTTYLauncher,
    validateLauncherDraft,
} from './gotty-launcher.js';
import {
    GOTTY_LAUNCHER_PORT_END,
    GOTTY_LAUNCHER_PORT_START,
    findAvailableGoTTYLauncherPort,
} from './gotty-launcher-ports.js';

const PRESETS = [
    { label: 'MC', name: 'MC', command: 'mc', icon: '📁' },
    { label: 'btop', name: 'btop', command: 'btop', icon: '📊' },
    { label: 'Fish', name: 'Fish', command: 'fish', icon: '🐟' },
];

function launchersFrom(config) {
    return (config?.services || []).filter(service => service?.type === GOTTY_LAUNCHER_TYPE);
}

function messageFor(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export function GoTTYLauncherManager() {
    const [allowed, setAllowed] = useState(false);
    const [open, setOpen] = useState(false);
    const [launchers, setLaunchers] = useState([]);
    const [draft, setDraft] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const [allocatingPort, setAllocatingPort] = useState(false);

    useEffect(() => {
        const permission = window.cockpit.permission({ admin: true });
        const update = () => setAllowed(permission.allowed === true);
        update();
        permission.addEventListener('changed', update);
        return () => {
            permission.removeEventListener('changed', update);
            permission.close();
        };
    }, []);

    const refresh = async () => {
        const config = await readConfiguration();
        setLaunchers(launchersFrom(config));
    };

    const openManager = async () => {
        setNotice('');
        setDraft(null);
        setEditingId(null);
        try {
            await refresh();
            setOpen(true);
        } catch (error) {
            setNotice(messageFor(error));
            setOpen(true);
        }
    };

    const beginNew = async preset => {
        setAllocatingPort(true);
        setNotice('');
        try {
            const port = await findAvailableGoTTYLauncherPort(window.cockpit, launchers);
            if (!port) {
                setNotice(`No free automatic GoTTY launcher port remains in ${GOTTY_LAUNCHER_PORT_START}-${GOTTY_LAUNCHER_PORT_END}. Edit an existing launcher or choose a custom port.`);
                return;
            }

            const base = launcherDraft(null, port);
            setDraft({
                ...base,
                ...(preset ? {
                    name: preset.name,
                    command: preset.command,
                    icon: preset.icon,
                } : {}),
            });
            setEditingId(null);
            setErrors({});
        } catch (error) {
            setNotice(`Could not choose a launcher port: ${messageFor(error)}`);
        } finally {
            setAllocatingPort(false);
        }
    };

    const beginEdit = service => {
        setDraft(launcherDraft(service));
        setEditingId(service.id);
        setErrors({});
        setNotice('');
    };

    const update = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
        setErrors(current => ({ ...current, [field]: undefined }));
    };

    const save = async event => {
        event.preventDefault();
        const validation = validateLauncherDraft(draft);
        setErrors(validation);
        if (Object.keys(validation).length)
            return;

        setSaving(true);
        setNotice('');
        try {
            await modifyConfiguration(current => {
                const services = [...current.services];
                const index = editingId ? services.findIndex(service => service?.id === editingId) : -1;
                const original = index >= 0 ? services[index] : null;
                const service = buildLauncherService(draft, original);
                if (index >= 0)
                    services[index] = service;
                else
                    services.push(service);
                return { ...current, services };
            }, editingId ? `Edited GoTTY launcher ${draft.name}` : `Added GoTTY launcher ${draft.name}`);
            await refresh();
            setDraft(null);
            setEditingId(null);
        } catch (error) {
            setNotice(`Could not save launcher: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const remove = async service => {
        setSaving(true);
        setNotice('');
        try {
            await stopGoTTYLauncher(window.cockpit, service).catch(() => {});
            await modifyConfiguration(current => ({
                ...current,
                services: current.services.filter(item => item?.id !== service.id),
            }), `Deleted GoTTY launcher ${service.name}`);
            await refresh();
        } catch (error) {
            setNotice(`Could not delete launcher: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const stop = async service => {
        setSaving(true);
        setNotice('');
        try {
            await stopGoTTYLauncher(window.cockpit, service);
            setNotice(`${service.name} stopped.`);
        } catch (error) {
            setNotice(`Could not stop ${service.name}: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const exposed = useMemo(() => draft && isNetworkExposedAddress(draft.address), [draft]);

    if (!allowed)
        return null;

    return (
        <div className="gotty-launcher-manager-floating">
            <Button variant="secondary" onClick={openManager}>GoTTY launchers</Button>

            <Modal isOpen={open} onClose={() => !saving && !allocatingPort && setOpen(false)} variant="medium">
                <ModalHeader title="On-demand GoTTY launchers" />
                <ModalBody>
                    {notice && <Alert isInline variant={notice.includes('Could not') || notice.includes('No free') ? 'danger' : 'info'} title={notice} />}

                    {!draft ? (
                        <>
                            <p className="gotty-launcher-intro">
                                Launcher bookmarks start GoTTY only when clicked, run the selected terminal application as the logged-in Cockpit user,
                                and stop automatically after the configured runtime.
                            </p>
                            <div className="bookmark-field-help">
                                New launchers automatically use the first free port in <code>{GOTTY_LAUNCHER_PORT_START}-{GOTTY_LAUNCHER_PORT_END}</code>, skipping both configured launchers and ports already listening on this host.
                            </div>
                            <div className="gotty-launcher-presets">
                                <Button variant="primary" onClick={() => beginNew(null)} isDisabled={saving || allocatingPort}>
                                    {allocatingPort ? 'Finding port…' : 'New launcher'}
                                </Button>
                                {PRESETS.map(preset => (
                                    <Button variant="secondary" onClick={() => beginNew(preset)} isDisabled={saving || allocatingPort} key={preset.label}>
                                        New {preset.label}
                                    </Button>
                                ))}
                            </div>

                            {launchers.length === 0 ? (
                                <div className="gotty-launcher-empty">No on-demand GoTTY launchers configured yet.</div>
                            ) : (
                                <div className="gotty-launcher-list">
                                    {launchers.map(service => (
                                        <div className="gotty-launcher-item" key={service.id}>
                                            <div>
                                                <strong>{service.icon || '⌨️'} {service.name}</strong>
                                                <code>{service.gottyLauncher?.command}</code>
                                                <span>
                                                    TCP {service.gottyLauncher?.port} · {service.gottyLauncher?.address} · auto-stop {service.gottyLauncher?.autoStopMinutes} min
                                                </span>
                                            </div>
                                            <div className="gotty-launcher-item-actions">
                                                <Button variant="link" onClick={() => beginEdit(service)} isDisabled={saving || allocatingPort}>Edit</Button>
                                                <Button variant="link" onClick={() => stop(service)} isDisabled={saving || allocatingPort}>Stop</Button>
                                                <Button variant="link" isDanger onClick={() => remove(service)} isDisabled={saving || allocatingPort}>Delete</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <Form id="gotty-launcher-form" onSubmit={save}>
                            <FormGroup label="Bookmark name" isRequired fieldId="gotty-launcher-name">
                                <TextInput id="gotty-launcher-name" value={draft.name} onChange={(_event, value) => update('name', value)} validated={errors.name ? 'error' : 'default'} />
                                {errors.name && <div className="bookmark-field-error">{errors.name}</div>}
                            </FormGroup>

                            <FormGroup label="Application command" isRequired fieldId="gotty-launcher-command">
                                <TextInput id="gotty-launcher-command" value={draft.command} onChange={(_event, value) => update('command', value)} placeholder="mc" validated={errors.command ? 'error' : 'default'} />
                                {errors.command && <div className="bookmark-field-error">{errors.command}</div>}
                                <div className="bookmark-field-help">Examples: <code>mc</code>, <code>btop</code>, <code>fish</code>, or an absolute executable path.</div>
                            </FormGroup>

                            <FormGroup label="Arguments" fieldId="gotty-launcher-args">
                                <TextArea id="gotty-launcher-args" value={draft.args} onChange={(_event, value) => update('args', value)} resizeOrientation="vertical" placeholder={'--some-option\n/path/with spaces'} />
                                <div className="bookmark-field-help">Optional. One argument per line. Arguments are passed directly; they are not interpreted by a shell.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="TCP port" isRequired fieldId="gotty-launcher-port">
                                    <TextInput id="gotty-launcher-port" type="number" value={draft.port} onChange={(_event, value) => update('port', value)} validated={errors.port ? 'error' : 'default'} />
                                    {errors.port && <div className="bookmark-field-error">{errors.port}</div>}
                                    <div className="bookmark-field-help">Automatically selected from {GOTTY_LAUNCHER_PORT_START}-{GOTTY_LAUNCHER_PORT_END}. You may override it with another unprivileged port.</div>
                                </FormGroup>
                                <FormGroup label="Auto-stop minutes" isRequired fieldId="gotty-launcher-timeout">
                                    <TextInput id="gotty-launcher-timeout" type="number" value={draft.autoStopMinutes} onChange={(_event, value) => update('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                                    {errors.autoStopMinutes && <div className="bookmark-field-error">{errors.autoStopMinutes}</div>}
                                </FormGroup>
                            </div>

                            <FormGroup label="Listen address" isRequired fieldId="gotty-launcher-address">
                                <TextInput id="gotty-launcher-address" value={draft.address} onChange={(_event, value) => update('address', value)} placeholder="127.0.0.1" validated={errors.address ? 'error' : 'default'} />
                                {errors.address && <div className="bookmark-field-error">{errors.address}</div>}
                                <div className="bookmark-field-help">Default <code>127.0.0.1</code> is safest. A remote browser normally needs a network-facing address such as <code>0.0.0.0</code> or an address reachable through a trusted VPN/firewall.</div>
                            </FormGroup>
                            {exposed && (
                                <Alert isInline variant="warning" title="Writable terminal will be network-facing">
                                    GoTTY is started with interactive input enabled. Only expose this port on a trusted LAN/VPN or behind appropriate network controls.
                                </Alert>
                            )}

                            <FormGroup label="GoTTY executable" isRequired fieldId="gotty-launcher-binary">
                                <TextInput id="gotty-launcher-binary" value={draft.binary} onChange={(_event, value) => update('binary', value)} placeholder="gotty" validated={errors.binary ? 'error' : 'default'} />
                                {errors.binary && <div className="bookmark-field-error">{errors.binary}</div>}
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Group" fieldId="gotty-launcher-group">
                                    <TextInput id="gotty-launcher-group" value={draft.group} onChange={(_event, value) => update('group', value)} placeholder="Terminal" />
                                </FormGroup>
                                <FormGroup label="Icon" fieldId="gotty-launcher-icon">
                                    <TextInput id="gotty-launcher-icon" value={draft.icon} onChange={(_event, value) => update('icon', value)} placeholder="⌨️" />
                                </FormGroup>
                            </div>

                            <FormGroup label="Card accent" fieldId="gotty-launcher-accent">
                                <select id="gotty-launcher-accent" className="bookmark-select" value={draft.accent} onChange={event => update('accent', event.target.value)}>
                                    <option value="teal">Teal</option>
                                    <option value="blue">Blue</option>
                                    <option value="green">Green</option>
                                    <option value="purple">Purple</option>
                                    <option value="orange">Orange</option>
                                    <option value="red">Red</option>
                                    <option value="none">Default</option>
                                </select>
                            </FormGroup>
                        </Form>
                    )}
                </ModalBody>
                <ModalFooter>
                    {draft ? (
                        <>
                            <Button variant="primary" type="submit" form="gotty-launcher-form" isDisabled={saving}>{saving ? 'Saving…' : (editingId ? 'Save launcher' : 'Add launcher')}</Button>
                            <Button variant="link" onClick={() => setDraft(null)} isDisabled={saving}>Back</Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={() => setOpen(false)} isDisabled={saving || allocatingPort}>Close</Button>
                    )}
                </ModalFooter>
            </Modal>
        </div>
    );
}
