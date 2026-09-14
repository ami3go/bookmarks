import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import {
    ADD_APP_EVENT,
    ADD_APP_TYPES,
    APP_TYPE_CUSTOM,
    addAppTypeLabel,
    createAddAppDraft,
    isTerminalAddAppType,
    normalizeAddAppType,
} from './add-app.js';
import {
    buildApplicationService,
    validateApplicationDraft,
} from './application-launcher.js';
import {
    APPLICATION_LAUNCHER_PORT_END,
    APPLICATION_LAUNCHER_PORT_START,
    findAvailableApplicationLauncherPort,
} from './application-launcher-ports.js';
import { modifyConfiguration, readConfiguration } from './cockpit-config.js';
import {
    GOTTY_LAUNCHER_PORT_END,
    GOTTY_LAUNCHER_PORT_START,
    findAvailableGoTTYLauncherPort,
} from './gotty-launcher-ports.js';
import {
    buildLauncherService,
    defaultBinaryForProvider,
    isNetworkExposedAddress,
    terminalProviderLabel,
    validateLauncherDraft,
} from './terminal-launcher.js';

function messageFor(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

function isApplicationNetworkFacing(draft) {
    const value = String(draft?.bindHost || '').trim().toLowerCase();
    return Boolean(draft) && !['127.0.0.1', 'localhost', '::1'].includes(value) && !value.startsWith('127.');
}

export function AddAppManager() {
    const [allowed, setAllowed] = useState(false);
    const [open, setOpen] = useState(false);
    const [appType, setAppType] = useState(APP_TYPE_CUSTOM);
    const [draft, setDraft] = useState(null);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const [allocatingPort, setAllocatingPort] = useState(false);
    const allocationSequence = useRef(0);

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

    const prepareType = useCallback(async value => {
        const type = normalizeAddAppType(value);
        const sequence = ++allocationSequence.current;
        setAppType(type);
        setDraft(null);
        setErrors({});
        setNotice('');
        setAllocatingPort(true);

        try {
            const config = await readConfiguration();
            const services = config?.services || [];
            const terminal = isTerminalAddAppType(type);
            const port = terminal
                ? await findAvailableGoTTYLauncherPort(window.cockpit, services)
                : await findAvailableApplicationLauncherPort(window.cockpit, services);

            if (sequence !== allocationSequence.current)
                return;

            if (!port) {
                const range = terminal
                    ? `${GOTTY_LAUNCHER_PORT_START}-${GOTTY_LAUNCHER_PORT_END}`
                    : `${APPLICATION_LAUNCHER_PORT_START}-${APPLICATION_LAUNCHER_PORT_END}`;
                setNotice(`No free automatic port remains in ${range}. Free a port or edit an existing launcher to use a custom port.`);
                return;
            }

            setDraft(createAddAppDraft(type, port));
        } catch (error) {
            if (sequence === allocationSequence.current)
                setNotice(`Could not prepare ${addAppTypeLabel(type)} defaults: ${messageFor(error)}`);
        } finally {
            if (sequence === allocationSequence.current)
                setAllocatingPort(false);
        }
    }, []);

    useEffect(() => {
        const handleAddApp = () => {
            if (!allowed)
                return;
            setOpen(true);
            prepareType(APP_TYPE_CUSTOM);
        };
        window.addEventListener(ADD_APP_EVENT, handleAddApp);
        return () => window.removeEventListener(ADD_APP_EVENT, handleAddApp);
    }, [allowed, prepareType]);

    const close = () => {
        if (saving)
            return;
        allocationSequence.current += 1;
        setAllocatingPort(false);
        setOpen(false);
        setDraft(null);
        setErrors({});
        setNotice('');
    };

    const update = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
        setErrors(current => ({ ...current, [field]: undefined }));
        setNotice('');
    };

    const terminal = isTerminalAddAppType(appType);
    const providerLabel = terminalProviderLabel(draft?.provider);
    const networkFacing = useMemo(
        () => terminal ? Boolean(draft && isNetworkExposedAddress(draft.address)) : isApplicationNetworkFacing(draft),
        [terminal, draft]
    );

    const save = async event => {
        event.preventDefault();
        if (!draft || allocatingPort)
            return;

        const validation = terminal ? validateLauncherDraft(draft) : validateApplicationDraft(draft);
        setErrors(validation);
        if (Object.keys(validation).length)
            return;

        setSaving(true);
        setNotice('');
        try {
            const service = terminal
                ? buildLauncherService({ ...draft, group: 'Applications' })
                : buildApplicationService(draft);
            await modifyConfiguration(current => ({
                ...current,
                services: [...current.services, service],
            }), `Added ${addAppTypeLabel(appType)} application ${draft.name}`);
            close();
        } catch (error) {
            setNotice(`Could not add application: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    if (!allowed)
        return null;

    return (
        <Modal isOpen={open} onClose={close} variant="medium">
            <ModalHeader title="Add app" />
            <ModalBody>
                {notice && (
                    <Alert
                        isInline
                        variant={notice.startsWith('Could not') || notice.startsWith('No free') ? 'danger' : 'info'}
                        title={notice}
                    />
                )}

                <Form id="add-app-form" onSubmit={save}>
                    <FormGroup label="Application type" isRequired fieldId="add-app-type">
                        <select
                            id="add-app-type"
                            className="bookmark-select"
                            value={appType}
                            onChange={event => prepareType(event.target.value)}
                            disabled={saving}
                        >
                            {ADD_APP_TYPES.map(type => (
                                <option value={type.value} key={type.value}>{type.label}</option>
                            ))}
                        </select>
                        <div className="bookmark-field-help">
                            Choosing a type replaces the creation fields with that launcher's defaults and automatically selects a free TCP port.
                        </div>
                    </FormGroup>

                    {allocatingPort && (
                        <div className="bookmark-field-help">Choosing a free port and loading defaults…</div>
                    )}

                    {draft && terminal && (
                        <>
                            <FormGroup label="Application name" isRequired fieldId="add-app-name">
                                <TextInput id="add-app-name" value={draft.name} onChange={(_event, value) => update('name', value)} validated={errors.name ? 'error' : 'default'} />
                                {errors.name && <div className="bookmark-field-error">{errors.name}</div>}
                            </FormGroup>

                            <FormGroup label="Application command" isRequired fieldId="add-app-command">
                                <TextInput id="add-app-command" value={draft.command} onChange={(_event, value) => update('command', value)} placeholder="bash" validated={errors.command ? 'error' : 'default'} />
                                {errors.command && <div className="bookmark-field-error">{errors.command}</div>}
                                <div className="bookmark-field-help">The command runs inside the selected web terminal. Examples: <code>bash</code>, <code>mc</code>, <code>btop</code>, or <code>fish</code>.</div>
                            </FormGroup>

                            <FormGroup label="Arguments" fieldId="add-app-args">
                                <TextArea id="add-app-args" value={draft.args} onChange={(_event, value) => update('args', value)} resizeOrientation="vertical" placeholder={'--some-option\n/path/with spaces'} />
                                <div className="bookmark-field-help">Optional. One argument per line; arguments are passed directly without shell interpolation.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="TCP port" isRequired fieldId="add-app-port">
                                    <TextInput id="add-app-port" type="number" value={draft.port} onChange={(_event, value) => update('port', value)} validated={errors.port ? 'error' : 'default'} />
                                    {errors.port && <div className="bookmark-field-error">{errors.port}</div>}
                                </FormGroup>
                                <FormGroup label="Auto-stop minutes" isRequired fieldId="add-app-auto-stop">
                                    <TextInput id="add-app-auto-stop" type="number" value={draft.autoStopMinutes} onChange={(_event, value) => update('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                                    {errors.autoStopMinutes && <div className="bookmark-field-error">{errors.autoStopMinutes}</div>}
                                </FormGroup>
                            </div>

                            <FormGroup label="Listen address" isRequired fieldId="add-app-address">
                                <TextInput id="add-app-address" value={draft.address} onChange={(_event, value) => update('address', value)} placeholder="{host}" validated={errors.address ? 'error' : 'default'} />
                                {errors.address && <div className="bookmark-field-error">{errors.address}</div>}
                                <div className="bookmark-field-help">Default <code>{'{host}'}</code> expands to the Cockpit hostname/IP. Use <code>127.0.0.1</code> for local-only binding.</div>
                            </FormGroup>

                            {networkFacing && (
                                <Alert isInline variant="warning" title="Writable terminal will be network-facing">
                                    {providerLabel} starts with interactive input enabled. Only expose it on a trusted LAN/VPN or behind appropriate network controls.
                                </Alert>
                            )}

                            <FormGroup label={`${providerLabel} executable`} isRequired fieldId="add-app-binary">
                                <TextInput id="add-app-binary" value={draft.binary} onChange={(_event, value) => update('binary', value)} placeholder={defaultBinaryForProvider(draft.provider)} validated={errors.binary ? 'error' : 'default'} />
                                {errors.binary && <div className="bookmark-field-error">{errors.binary}</div>}
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Icon" fieldId="add-app-icon">
                                    <TextInput id="add-app-icon" value={draft.icon} onChange={(_event, value) => update('icon', value)} placeholder="⌨️" />
                                </FormGroup>
                                <FormGroup label="Card accent" fieldId="add-app-accent">
                                    <select id="add-app-accent" className="bookmark-select" value={draft.accent} onChange={event => update('accent', event.target.value)}>
                                        <option value="teal">Teal</option><option value="blue">Blue</option><option value="green">Green</option>
                                        <option value="purple">Purple</option><option value="orange">Orange</option><option value="red">Red</option><option value="none">Default</option>
                                    </select>
                                </FormGroup>
                            </div>
                        </>
                    )}

                    {draft && !terminal && (
                        <>
                            <FormGroup label="Application name" isRequired fieldId="add-app-name">
                                <TextInput id="add-app-name" value={draft.name} onChange={(_event, value) => update('name', value)} validated={errors.name ? 'error' : 'default'} />
                                {errors.name && <div className="bookmark-field-error">{errors.name}</div>}
                            </FormGroup>

                            <FormGroup label="Command" isRequired fieldId="add-app-command">
                                <TextInput id="add-app-command" value={draft.command} onChange={(_event, value) => update('command', value)} placeholder="/usr/local/bin/my-app" validated={errors.command ? 'error' : 'default'} />
                                {errors.command && <div className="bookmark-field-error">{errors.command}</div>}
                                <div className="bookmark-field-help">Absolute paths are recommended for systemd user services.</div>
                            </FormGroup>

                            <FormGroup label="Arguments" fieldId="add-app-args">
                                <TextArea id="add-app-args" value={draft.args} onChange={(_event, value) => update('args', value)} resizeOrientation="vertical" placeholder={'--host\n{bind}\n--port\n{port}'} />
                                <div className="bookmark-field-help">One argv entry per line. Placeholders: <code>{'{host}'}</code> Cockpit hostname/IP, <code>{'{bind}'}</code> bind address, <code>{'{port}'}</code> configured port.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Bind host" isRequired fieldId="add-app-bind-host">
                                    <TextInput id="add-app-bind-host" value={draft.bindHost} onChange={(_event, value) => update('bindHost', value)} placeholder="0.0.0.0" validated={errors.bindHost ? 'error' : 'default'} />
                                    {errors.bindHost && <div className="bookmark-field-error">{errors.bindHost}</div>}
                                </FormGroup>
                                <FormGroup label="TCP port" isRequired fieldId="add-app-port">
                                    <TextInput id="add-app-port" type="number" value={draft.port} onChange={(_event, value) => update('port', value)} validated={errors.port ? 'error' : 'default'} />
                                    {errors.port && <div className="bookmark-field-error">{errors.port}</div>}
                                </FormGroup>
                            </div>

                            {networkFacing && (
                                <Alert isInline variant="warning" title="Application will be network-facing">
                                    A wildcard/LAN bind exposes the application's HTTP server. Use authentication and a trusted LAN/VPN or reverse proxy as appropriate.
                                </Alert>
                            )}

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Auto-stop minutes" isRequired fieldId="add-app-auto-stop">
                                    <TextInput id="add-app-auto-stop" type="number" value={draft.autoStopMinutes} onChange={(_event, value) => update('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                                    {errors.autoStopMinutes && <div className="bookmark-field-error">{errors.autoStopMinutes}</div>}
                                </FormGroup>
                                <FormGroup label="Startup timeout seconds" isRequired fieldId="add-app-startup-timeout">
                                    <TextInput id="add-app-startup-timeout" type="number" value={draft.startupTimeoutSeconds} onChange={(_event, value) => update('startupTimeoutSeconds', value)} validated={errors.startupTimeoutSeconds ? 'error' : 'default'} />
                                    {errors.startupTimeoutSeconds && <div className="bookmark-field-error">{errors.startupTimeoutSeconds}</div>}
                                </FormGroup>
                            </div>

                            <FormGroup label="Live URL command" fieldId="add-app-url-command">
                                <TextInput id="add-app-url-command" value={draft.urlCommand} onChange={(_event, value) => update('urlCommand', value)} placeholder="optional command" />
                                <div className="bookmark-field-help">Optional command used to recover a live browser URL when the application is already running.</div>
                            </FormGroup>

                            <FormGroup label="Live URL command arguments" fieldId="add-app-url-args">
                                <TextArea id="add-app-url-args" value={draft.urlArgs} onChange={(_event, value) => update('urlArgs', value)} resizeOrientation="vertical" placeholder="one argument per line" />
                            </FormGroup>

                            <FormGroup label="URL detection pattern" isRequired fieldId="add-app-url-pattern">
                                <TextInput id="add-app-url-pattern" value={draft.urlPattern} onChange={(_event, value) => update('urlPattern', value)} validated={errors.urlPattern ? 'error' : 'default'} />
                                {errors.urlPattern && <div className="bookmark-field-error">{errors.urlPattern}</div>}
                                <div className="bookmark-field-help">Regular expression applied to application output. The first capture group is used when present; otherwise the complete match is used.</div>
                            </FormGroup>

                            <div className="gotty-launcher-grid">
                                <FormGroup label="Icon" fieldId="add-app-icon">
                                    <TextInput id="add-app-icon" value={draft.icon} onChange={(_event, value) => update('icon', value)} placeholder="🚀" />
                                </FormGroup>
                                <FormGroup label="Card accent" fieldId="add-app-accent">
                                    <select id="add-app-accent" className="bookmark-select" value={draft.accent} onChange={event => update('accent', event.target.value)}>
                                        <option value="orange">Orange</option><option value="teal">Teal</option><option value="blue">Blue</option>
                                        <option value="green">Green</option><option value="purple">Purple</option><option value="red">Red</option><option value="none">Default</option>
                                    </select>
                                </FormGroup>
                            </div>
                        </>
                    )}
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" type="submit" form="add-app-form" isDisabled={saving || allocatingPort || !draft}>
                    {saving ? 'Adding…' : `Add ${addAppTypeLabel(appType)}`}
                </Button>
                <Button variant="link" onClick={close} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
