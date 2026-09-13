import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import { modifyConfiguration, readConfiguration } from './cockpit-config.js';
import {
    TERMINAL_LAUNCHER_TYPE,
    TERMINAL_PROVIDER_GOTTY,
    TERMINAL_PROVIDER_TTYD,
    buildLauncherService,
    defaultBinaryForProvider,
    isNetworkExposedAddress,
    launcherDraft,
    normalizeTerminalProvider,
    stopTerminalLauncher,
    terminalProviderLabel,
    validateLauncherDraft,
} from './terminal-launcher.js';
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
    return (config?.services || []).filter(service => service?.type === TERMINAL_LAUNCHER_TYPE);
}

function messageFor(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export function TerminalLauncherManager() {
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
        const updatePermission = () => setAllowed(permission.allowed === true);
        updatePermission();
        permission.addEventListener('changed', updatePermission);
        return () => {
            permission.removeEventListener('changed', updatePermission);
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
                setNotice(`No free automatic terminal launcher port remains in ${GOTTY_LAUNCHER_PORT_START}-${GOTTY_LAUNCHER_PORT_END}. Edit an existing launcher or choose a custom port.`);
                return;
            }
            const base = launcherDraft(null, port);
            setDraft({
                ...base,
                ...(preset ? { name: preset.name, command: preset.command, icon: preset.icon } : {}),
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

    const updateProvider = providerValue => {
        const provider = normalizeTerminalProvider(providerValue);
        setDraft(current => {
            const oldProvider = normalizeTerminalProvider(current.provider);
            const oldDefault = defaultBinaryForProvider(oldProvider);
            const binary = !current.binary || current.binary === oldDefault
                ? defaultBinaryForProvider(provider)
                : current.binary;
            return { ...current, provider, binary };
        });
        setErrors(current => ({ ...current, provider: undefined, binary: undefined }));
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
            }, editingId ? `Edited terminal launcher ${draft.name}` : `Added terminal launcher ${draft.name}`);
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
            await stopTerminalLauncher(window.cockpit, service).catch(() => {});
            await modifyConfiguration(current => ({
                ...current,
                services: current.services.filter(item => item?.id !== service.id),
            }), `Deleted terminal launcher ${service.name}`);
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
            await stopTerminalLauncher(window.cockpit, service);
            setNotice(`${service.name} stopped.`);
        } catch (error) {
            setNotice(`Could not stop ${service.name}: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const exposed = useMemo(() => draft && isNetworkExposedAddress(draft.address), [draft]);
    const providerLabel = terminalProviderLabel(draft?.provider);

    if (!allowed)
        return null;

    return (
        <div className="gotty-launcher-manager-floating">
            <Button variant="secondary" onClick={openManager}>Terminal launchers</Button>

            <Modal isOpen={open} onClose={() => !saving && !allocatingPort && setOpen(false)} variant="medium">
                <ModalHeader title="On-demand terminal launchers" />
                <ModalBody>
                    {notice && <Alert isInline variant={notice.includes('Could not') || notice.includes('No free') ? 'danger' : 'info'} title={notice} />}

                    {!draft ? (
                        <>
                            <p className="gotty-launcher-intro">
                                Launcher bookmarks start GoTTY or ttyd only when clicked, run the selected terminal application as the logged-in Cockpit user,
                                and stop automatically after the configured runtime.
                            </p>
                            <div className="bookmark-field-help">
                                New launchers automatically use the first free port in <code>{GOTTY_LAUNCHER_PORT_START}-{GOTTY_LAUNCHER_PORT_END}</code>, skipping configured launchers and ports already listening on this host.
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
                                <div className="gotty-launcher-empty">No on-demand terminal launchers configured yet.</div>
                            ) : (
                                <div className="gotty-launcher-list">
                                    {launchers.map(service => {
                                        const launcher = service.gottyLauncher || {};
                                        return (
                                            <div className="gotty-launcher-item" key={service.id}>
                                                <div>
                                                    <strong>{service.icon || '⌨️'} {service.name}</strong>
                                                    <code>{terminalProviderLabel(launcher.provider)} · {launcher.command}</code>
                                                    <span>TCP {launcher.port} · {launcher.address} · auto-stop {launcher.autoStopMinutes} min</span>
                                                </div>
                                                <div className="gotty-launcher-item-actions">
                                                    <Button variant="link" onClick={() => beginEdit(service)} isDisabled={saving || allocatingPort}>Edit</Button>
                                                    <Button variant="link" onClick={() => stop(service)} isDisabled={saving || allocatingPort}>Stop</Button>
                                                    <Button variant="link" isDanger onClick={() => remove(service)} isDisabled={saving || allocatingPort}>Delete</Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <Form id="terminal-launcher-form" onSubmit={save}>
                            <FormGroup label="Bookmark name" isRequired fieldId="terminal-launcher-name">
                                <TextInput id="terminal-launcher-name" value={draft.name} onChange={(_event, value) => update('name', value)} validated={errors.name ? 'error' : 'default'} />
                                {errors.name && <div className="bookmark-field-error">{errors.name}</div>}
                            </FormGroup>

                            <FormGroup label="Terminal server" isRequired fieldId="terminal-launcher-provider">
                                <select id="terminal-launcher-provider" className="bookmark-select" value={normalizeTerminalProvider(draft.provider)} onChange={event => updateProvider(event.target.value)}>
                                    <option value={TERMINAL_PROVIDER_GOTTY}>GoTTY</option>
                                    <option value={TERMINAL_PROVIDER_TTYD}>ttyd</option>
                                </select>
                                <div className="bookmark-field-help">Choose which web-terminal server starts this launcher. Existing launchers without this setting remain GoTTY.</div>
                            </FormGroup>

                            <FormGroup label="Application command" isRequired fieldId="terminal-launcher-command">
                                <TextInput id="terminal-launcher-command" value={draft.command} onChange={(_event, value) => update('command', value)} placeholder="mc" validated={errors.command ? 'error' : 'default'} />
                                {errors.command && <div className="bookmark-field-error">{errors.command}</div>}
                                <div className="bookmark-field-help">Examples: <code>mc</code>, <code>btop</code>, <code>fish</code>, or an absolute executable path. Use <code>{'{host}'}</code> for the Cockpit host name or IP address.</div>
                            </FormGroup>

                            <FormGroup label="Arguments" fieldId="terminal-launcher-args">
                                <TextArea id="terminal-launcher-args" value={draft.args} onChange={(_event, value) => update('args', value)} resizeOrientation="vertical" placeholder={'--some-option\n/path/with spaces'} />
                                <div className="bookmark-field-help">Optional. One argument per line. Arguments are passed directly; they are not interpreted by a shell.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="TCP port" isRequired fieldId="terminal-launcher-port">
                                    <TextInput id="terminal-launcher-port" type="number" value={draft.port} onChange={(_event, value) => update('port', value)} validated={errors.port ? 'error' : 'default'} />
                                    {errors.port && <div className="bookmark-field-error">{errors.port}</div>}
                                </FormGroup>
                                <FormGroup label="Auto-stop minutes" isRequired fieldId="terminal-launcher-timeout">
                                    <TextInput id="terminal-launcher-timeout" type="number" value={draft.autoStopMinutes} onChange={(_event, value) => update('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                                    {errors.autoStopMinutes && <div className="bookmark-field-error">{errors.autoStopMinutes}</div>}
                                </FormGroup>
                            </div>

                            <FormGroup label="Listen address" isRequired fieldId="terminal-launcher-address">
                                <TextInput id="terminal-launcher-address" value={draft.address} onChange={(_event, value) => update('address', value)} placeholder="127.0.0.1" validated={errors.address ? 'error' : 'default'} />
                                {errors.address && <div className="bookmark-field-error">{errors.address}</div>}
                                <div className="bookmark-field-help">Default <code>127.0.0.1</code> is safest. Use a reachable LAN/VPN address only when remote browser access is required.</div>
                            </FormGroup>
                            {exposed && (
                                <Alert isInline variant="warning" title="Writable terminal will be network-facing">
                                    {providerLabel} is started with interactive input enabled. Only expose this port on a trusted LAN/VPN or behind appropriate network controls.
                                </Alert>
                            )}

                            <FormGroup label={`${providerLabel} executable`} isRequired fieldId="terminal-launcher-binary">
                                <TextInput id="terminal-launcher-binary" value={draft.binary} onChange={(_event, value) => update('binary', value)} placeholder={defaultBinaryForProvider(draft.provider)} validated={errors.binary ? 'error' : 'default'} />
                                {errors.binary && <div className="bookmark-field-error">{errors.binary}</div>}
                                <div className="bookmark-field-help">An absolute path is recommended when the binary is not on the systemd user manager's PATH.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Group" fieldId="terminal-launcher-group">
                                    <TextInput id="terminal-launcher-group" value={draft.group} onChange={(_event, value) => update('group', value)} placeholder="Terminal" />
                                </FormGroup>
                                <FormGroup label="Icon" fieldId="terminal-launcher-icon">
                                    <TextInput id="terminal-launcher-icon" value={draft.icon} onChange={(_event, value) => update('icon', value)} placeholder="⌨️" />
                                </FormGroup>
                            </div>

                            <FormGroup label="Card accent" fieldId="terminal-launcher-accent">
                                <select id="terminal-launcher-accent" className="bookmark-select" value={draft.accent} onChange={event => update('accent', event.target.value)}>
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
                            <Button variant="primary" type="submit" form="terminal-launcher-form" isDisabled={saving}>{saving ? 'Saving…' : (editingId ? 'Save launcher' : 'Add launcher')}</Button>
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
