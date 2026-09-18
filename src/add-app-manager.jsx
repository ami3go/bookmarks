import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import {
    ADD_APP_TYPES,
    APP_TYPE_AGENT_OF_EMPIRES,
    APP_TYPE_CUSTOM,
    addAppTypeLabel,
    createAddAppDraft,
    isTerminalAddAppType,
    normalizeAddAppType,
    resolveApplicationCommandPaths,
} from './add-app.js';
import {
    buildApplicationService,
    validateApplicationDraft,
} from './application-launcher.js';
import {
    AGENT_OF_EMPIRES_DEFAULT_PORT,
    APPLICATION_LAUNCHER_PORT_END,
    APPLICATION_LAUNCHER_PORT_START,
    findAvailableAgentOfEmpiresPort,
    findAvailableApplicationLauncherPort,
} from './application-launcher-ports.js';
import { modifyConfiguration, readConfiguration } from './cockpit-config.js';
import { SelectControl } from './form-controls.jsx';
import {
    GOTTY_LAUNCHER_PORT_END,
    GOTTY_LAUNCHER_PORT_START,
    findAvailableGoTTYLauncherPort,
} from './gotty-launcher-ports.js';
import { ApplicationLauncherFields, TerminalLauncherFields } from './launcher-form-fields.jsx';
import {
    buildLauncherService,
    defaultBinaryForProvider,
    normalizeTerminalProvider,
    validateLauncherDraft,
} from './terminal-launcher.js';

function messageFor(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export function AddAppManager({ isOpen = false, onClose, onSaved }) {
    const [appType, setAppType] = useState(APP_TYPE_CUSTOM);
    const [draft, setDraft] = useState(null);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const [allocatingPort, setAllocatingPort] = useState(false);
    const allocationSequence = useRef(0);

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
            const agentOfEmpires = type === APP_TYPE_AGENT_OF_EMPIRES;
            const port = terminal
                ? await findAvailableGoTTYLauncherPort(window.cockpit, services)
                : agentOfEmpires
                    ? await findAvailableAgentOfEmpiresPort(window.cockpit, services)
                    : await findAvailableApplicationLauncherPort(window.cockpit, services);

            if (sequence !== allocationSequence.current)
                return;

            if (!port) {
                const range = terminal
                    ? `${GOTTY_LAUNCHER_PORT_START}-${GOTTY_LAUNCHER_PORT_END}`
                    : agentOfEmpires
                        ? `${AGENT_OF_EMPIRES_DEFAULT_PORT} or ${APPLICATION_LAUNCHER_PORT_START}-${APPLICATION_LAUNCHER_PORT_END}`
                        : `${APPLICATION_LAUNCHER_PORT_START}-${APPLICATION_LAUNCHER_PORT_END}`;
                setNotice(`No free automatic port remains in ${range}. Free a port or edit an existing launcher to use a custom port.`);
                return;
            }

            let preparedDraft = createAddAppDraft(type, port);
            if (!terminal)
                preparedDraft = await resolveApplicationCommandPaths(window.cockpit, preparedDraft);

            if (sequence !== allocationSequence.current)
                return;

            setDraft(preparedDraft);
        } catch (error) {
            if (sequence === allocationSequence.current)
                setNotice(`Could not prepare ${addAppTypeLabel(type)} defaults: ${messageFor(error)}`);
        } finally {
            if (sequence === allocationSequence.current)
                setAllocatingPort(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            allocationSequence.current += 1;
            setDraft(null);
            setErrors({});
            setNotice('');
            setAllocatingPort(false);
            return;
        }
        prepareType(APP_TYPE_CUSTOM);
    }, [isOpen, prepareType]);

    const update = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
        setErrors(current => ({ ...current, [field]: undefined }));
        setNotice('');
    };

    const updateProvider = providerValue => {
        const provider = normalizeTerminalProvider(providerValue);
        setDraft(current => {
            const oldProvider = normalizeTerminalProvider(current.provider);
            const oldDefault = defaultBinaryForProvider(oldProvider);
            return {
                ...current,
                provider,
                binary: !current.binary || current.binary === oldDefault
                    ? defaultBinaryForProvider(provider)
                    : current.binary,
            };
        });
        setErrors(current => ({ ...current, provider: undefined, binary: undefined }));
        setNotice('');
    };

    const close = () => {
        if (!saving)
            onClose?.();
    };

    const save = async event => {
        event.preventDefault();
        if (!draft || allocatingPort)
            return;

        const terminal = isTerminalAddAppType(appType);
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
            onSaved?.(service);
            onClose?.();
        } catch (error) {
            setNotice(`Could not add application: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const terminal = isTerminalAddAppType(appType);

    return (
        <Modal isOpen={isOpen} onClose={close} variant="medium">
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
                        <SelectControl
                            id="add-app-type"
                            value={appType}
                            onChange={prepareType}
                            isDisabled={saving}
                            options={ADD_APP_TYPES}
                        />
                        <div className="bookmark-field-help">
                            Choosing a type loads its launcher fields and defaults. Agent of Empires prefers its native port {AGENT_OF_EMPIRES_DEFAULT_PORT}; other web apps use the managed application range.
                        </div>
                    </FormGroup>

                    {allocatingPort && <div className="bookmark-field-help">Choosing a free port and loading defaults…</div>}

                    {draft && terminal && (
                        <TerminalLauncherFields
                            draft={draft}
                            errors={errors}
                            onChange={update}
                            onProviderChange={updateProvider}
                            idPrefix="add-app-terminal"
                            showGroup={false}
                        />
                    )}

                    {draft && !terminal && (
                        <ApplicationLauncherFields
                            draft={draft}
                            errors={errors}
                            onChange={update}
                            idPrefix="add-app-application"
                        />
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
