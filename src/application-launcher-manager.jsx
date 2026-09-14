import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import { modifyConfiguration, readConfiguration } from './cockpit-config.js';
import {
    APPLICATION_LAUNCHER_EDIT_EVENT,
    APPLICATION_LAUNCHER_TYPE,
    agentOfEmpiresDraft,
    applicationDraft,
    buildApplicationService,
    stopApplicationLauncher,
    validateApplicationDraft,
} from './application-launcher.js';
import {
    APPLICATION_LAUNCHER_PORT_END,
    APPLICATION_LAUNCHER_PORT_START,
    findAvailableApplicationLauncherPort,
} from './application-launcher-ports.js';

function applicationsFrom(config) {
    return (config?.services || []).filter(service => service?.type === APPLICATION_LAUNCHER_TYPE);
}

function messageFor(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export function ApplicationLauncherManager() {
    const [allowed, setAllowed] = useState(false);
    const [open, setOpen] = useState(false);
    const [applications, setApplications] = useState([]);
    const [allServices, setAllServices] = useState([]);
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
        setApplications(applicationsFrom(config));
        setAllServices(config?.services || []);
        return config;
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
            const config = await readConfiguration();
            const port = await findAvailableApplicationLauncherPort(window.cockpit, config?.services || []);
            if (!port) {
                setNotice(`No free automatic application port remains in ${APPLICATION_LAUNCHER_PORT_START}-${APPLICATION_LAUNCHER_PORT_END}. Choose a custom port by editing an existing launcher.`);
                return;
            }
            setAllServices(config?.services || []);
            setDraft(preset === 'aoe' ? agentOfEmpiresDraft(port) : applicationDraft(null, port));
            setEditingId(null);
            setErrors({});
        } catch (error) {
            setNotice(`Could not choose an application port: ${messageFor(error)}`);
        } finally {
            setAllocatingPort(false);
        }
    };

    const beginEdit = service => {
        setDraft(applicationDraft(service));
        setEditingId(service.id);
        setErrors({});
        setNotice('');
    };

    useEffect(() => {
        const handleEdit = async event => {
            const id = String(event.detail?.id || '').trim();
            if (!id)
                return;
            setNotice('');
            try {
                const config = await refresh();
                const service = applicationsFrom(config).find(item => item?.id === id);
                if (!service)
                    throw new Error('The application launcher no longer exists.');
                beginEdit(service);
                setOpen(true);
            } catch (error) {
                setNotice(`Could not open application editor: ${messageFor(error)}`);
                setOpen(true);
            }
        };
        window.addEventListener(APPLICATION_LAUNCHER_EDIT_EVENT, handleEdit);
        return () => window.removeEventListener(APPLICATION_LAUNCHER_EDIT_EVENT, handleEdit);
    }, []);

    const update = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
        setErrors(current => ({ ...current, [field]: undefined }));
        setNotice('');
    };

    const save = async event => {
        event.preventDefault();
        const validation = validateApplicationDraft(draft);
        setErrors(validation);
        if (Object.keys(validation).length)
            return;

        setSaving(true);
        setNotice('');
        try {
            let oldService = null;
            await modifyConfiguration(current => {
                const services = [...current.services];
                const index = editingId ? services.findIndex(service => service?.id === editingId && service?.type === APPLICATION_LAUNCHER_TYPE) : -1;
                oldService = index >= 0 ? services[index] : null;
                const service = buildApplicationService(draft, oldService);
                if (index >= 0)
                    services[index] = service;
                else
                    services.push(service);
                return { ...current, services };
            }, editingId ? `Edited application launcher ${draft.name}` : `Added application launcher ${draft.name}`);
            if (oldService)
                await stopApplicationLauncher(window.cockpit, oldService).catch(() => {});
            await refresh();
            setDraft(null);
            setEditingId(null);
        } catch (error) {
            setNotice(`Could not save application: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const stop = async service => {
        setSaving(true);
        setNotice('');
        try {
            await stopApplicationLauncher(window.cockpit, service);
            setNotice(`${service.name} stopped.`);
        } catch (error) {
            setNotice(`Could not stop ${service.name}: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const remove = async service => {
        setSaving(true);
        setNotice('');
        try {
            await stopApplicationLauncher(window.cockpit, service).catch(() => {});
            await modifyConfiguration(current => ({
                ...current,
                services: current.services.filter(item => item?.id !== service.id),
            }), `Deleted application launcher ${service.name}`);
            await refresh();
        } catch (error) {
            setNotice(`Could not delete application: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const networkFacing = useMemo(() => {
        const value = String(draft?.bindHost || '').trim().toLowerCase();
        return draft && !['127.0.0.1', 'localhost', '::1'].includes(value) && !value.startsWith('127.');
    }, [draft]);

    if (!allowed)
        return null;

    return (
        <div className="application-launcher-manager-floating">
            <Button variant="secondary" onClick={openManager}>Applications</Button>

            <Modal isOpen={open} onClose={() => !saving && !allocatingPort && setOpen(false)} variant="medium">
                <ModalHeader title="Applications" />
                <ModalBody>
                    {notice && <Alert isInline variant={notice.startsWith('Could not') || notice.startsWith('No free') ? 'danger' : 'info'} title={notice} />}
                    {!draft ? (
                        <>
                            <p className="gotty-launcher-intro">
                                Web application launchers start a user-level service on click, read the browser URL printed by the application, and open that URL in a new tab. Terminal launchers such as MC, btop, and Fish are shown in the same Applications category on the dashboard.
                            </p>
                            <div className="bookmark-field-help">
                                Web applications automatically use the first free port in <code>{APPLICATION_LAUNCHER_PORT_START}-{APPLICATION_LAUNCHER_PORT_END}</code>. Commands and arguments are passed directly without shell interpolation.
                            </div>
                            <div className="gotty-launcher-presets">
                                <Button variant="primary" onClick={() => beginNew(null)} isDisabled={saving || allocatingPort}>
                                    {allocatingPort ? 'Finding port…' : 'New web application'}
                                </Button>
                                <Button variant="secondary" onClick={() => beginNew('aoe')} isDisabled={saving || allocatingPort}>
                                    New Agent of Empires
                                </Button>
                            </div>
                            {applications.length === 0 ? (
                                <div className="gotty-launcher-empty">No web application launchers configured yet.</div>
                            ) : (
                                <div className="gotty-launcher-list">
                                    {applications.map(service => {
                                        const launcher = service.applicationLauncher || {};
                                        return (
                                            <div className="gotty-launcher-item" key={service.id}>
                                                <div>
                                                    <strong>{service.icon || '🚀'} {service.name}</strong>
                                                    <code>{launcher.command}</code>
                                                    <span>TCP {launcher.port} · {launcher.bindHost} · auto-stop {launcher.autoStopMinutes} min</span>
                                                </div>
                                                <div className="gotty-launcher-item-actions">
                                                    <Button variant="link" onClick={() => beginEdit(service)} isDisabled={saving}>Edit</Button>
                                                    <Button variant="link" onClick={() => stop(service)} isDisabled={saving}>Stop</Button>
                                                    <Button variant="link" isDanger onClick={() => remove(service)} isDisabled={saving}>Delete</Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <Form id="application-launcher-form" onSubmit={save}>
                            <FormGroup label="Application name" isRequired fieldId="application-name">
                                <TextInput id="application-name" value={draft.name} onChange={(_event, value) => update('name', value)} validated={errors.name ? 'error' : 'default'} />
                                {errors.name && <div className="bookmark-field-error">{errors.name}</div>}
                            </FormGroup>

                            <FormGroup label="Command" isRequired fieldId="application-command">
                                <TextInput id="application-command" value={draft.command} onChange={(_event, value) => update('command', value)} placeholder="/usr/local/bin/aoe" validated={errors.command ? 'error' : 'default'} />
                                {errors.command && <div className="bookmark-field-error">{errors.command}</div>}
                                <div className="bookmark-field-help">Absolute paths are recommended for systemd user services.</div>
                            </FormGroup>

                            <FormGroup label="Arguments" fieldId="application-args">
                                <TextArea id="application-args" value={draft.args} onChange={(_event, value) => update('args', value)} resizeOrientation="vertical" placeholder={'serve\n--host\n{bind}\n--port\n{port}'} />
                                <div className="bookmark-field-help">One argv entry per line. Placeholders: <code>{'{host}'}</code> Cockpit hostname/IP, <code>{'{bind}'}</code> bind address, <code>{'{port}'}</code> configured port.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Bind host" isRequired fieldId="application-bind-host">
                                    <TextInput id="application-bind-host" value={draft.bindHost} onChange={(_event, value) => update('bindHost', value)} placeholder="0.0.0.0" validated={errors.bindHost ? 'error' : 'default'} />
                                    {errors.bindHost && <div className="bookmark-field-error">{errors.bindHost}</div>}
                                </FormGroup>
                                <FormGroup label="TCP port" isRequired fieldId="application-port">
                                    <TextInput id="application-port" type="number" value={draft.port} onChange={(_event, value) => update('port', value)} validated={errors.port ? 'error' : 'default'} />
                                    {errors.port && <div className="bookmark-field-error">{errors.port}</div>}
                                </FormGroup>
                            </div>
                            {networkFacing && (
                                <Alert isInline variant="warning" title="Application will be network-facing">
                                    A wildcard/LAN bind exposes the application's HTTP server. Use token/passphrase authentication and a trusted LAN/VPN or reverse proxy as appropriate.
                                </Alert>
                            )}

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Auto-stop minutes" isRequired fieldId="application-auto-stop">
                                    <TextInput id="application-auto-stop" type="number" value={draft.autoStopMinutes} onChange={(_event, value) => update('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                                    {errors.autoStopMinutes && <div className="bookmark-field-error">{errors.autoStopMinutes}</div>}
                                </FormGroup>
                                <FormGroup label="Startup timeout seconds" isRequired fieldId="application-startup-timeout">
                                    <TextInput id="application-startup-timeout" type="number" value={draft.startupTimeoutSeconds} onChange={(_event, value) => update('startupTimeoutSeconds', value)} validated={errors.startupTimeoutSeconds ? 'error' : 'default'} />
                                    {errors.startupTimeoutSeconds && <div className="bookmark-field-error">{errors.startupTimeoutSeconds}</div>}
                                </FormGroup>
                            </div>

                            <FormGroup label="Live URL command" fieldId="application-url-command">
                                <TextInput id="application-url-command" value={draft.urlCommand} onChange={(_event, value) => update('urlCommand', value)} placeholder="aoe" />
                                <div className="bookmark-field-help">Optional command used to recover a live URL when the application is already running. Agent of Empires uses <code>aoe url</code>.</div>
                            </FormGroup>

                            <FormGroup label="Live URL command arguments" fieldId="application-url-args">
                                <TextArea id="application-url-args" value={draft.urlArgs} onChange={(_event, value) => update('urlArgs', value)} resizeOrientation="vertical" placeholder="url" />
                            </FormGroup>

                            <FormGroup label="URL detection pattern" isRequired fieldId="application-url-pattern">
                                <TextInput id="application-url-pattern" value={draft.urlPattern} onChange={(_event, value) => update('urlPattern', value)} validated={errors.urlPattern ? 'error' : 'default'} />
                                {errors.urlPattern && <div className="bookmark-field-error">{errors.urlPattern}</div>}
                                <div className="bookmark-field-help">Regular expression applied to application output. The first capture group is used when present; otherwise the complete match is used.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Icon" fieldId="application-icon">
                                    <TextInput id="application-icon" value={draft.icon} onChange={(_event, value) => update('icon', value)} placeholder="🚀" />
                                </FormGroup>
                                <FormGroup label="Card accent" fieldId="application-accent">
                                    <select id="application-accent" className="bookmark-select" value={draft.accent} onChange={event => update('accent', event.target.value)}>
                                        <option value="orange">Orange</option><option value="teal">Teal</option><option value="blue">Blue</option>
                                        <option value="green">Green</option><option value="purple">Purple</option><option value="red">Red</option><option value="none">Default</option>
                                    </select>
                                </FormGroup>
                            </div>
                        </Form>
                    )}
                </ModalBody>
                <ModalFooter>
                    {draft ? (
                        <>
                            <Button variant="primary" type="submit" form="application-launcher-form" isDisabled={saving}>{saving ? 'Saving…' : (editingId ? 'Save application' : 'Add application')}</Button>
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
