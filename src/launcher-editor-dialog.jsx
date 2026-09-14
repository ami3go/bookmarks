import React, { useEffect, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import {
    APPLICATION_LAUNCHER_TYPE,
    applicationDraft,
    buildApplicationService,
    stopApplicationLauncher,
    validateApplicationDraft,
} from './application-launcher.js';
import { modifyConfiguration } from './cockpit-config.js';
import { ApplicationLauncherFields, TerminalLauncherFields } from './launcher-form-fields.jsx';
import {
    TERMINAL_LAUNCHER_TYPE,
    buildLauncherService,
    defaultBinaryForProvider,
    launcherDraft,
    normalizeTerminalProvider,
    stopTerminalLauncher,
    validateLauncherDraft,
} from './terminal-launcher.js';

function messageFor(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

function isTerminal(service) {
    return service?.type === TERMINAL_LAUNCHER_TYPE;
}

function isApplication(service) {
    return service?.type === APPLICATION_LAUNCHER_TYPE;
}

export function LauncherEditorDialog({ service, onClose, onSaved }) {
    const [draft, setDraft] = useState(null);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!service) {
            setDraft(null);
            setErrors({});
            setNotice('');
            return;
        }
        if (isTerminal(service))
            setDraft(launcherDraft(service));
        else if (isApplication(service))
            setDraft(applicationDraft(service));
        else
            setDraft(null);
        setErrors({});
        setNotice('');
    }, [service]);

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
        if (!service || !draft)
            return;

        const terminal = isTerminal(service);
        const validation = terminal ? validateLauncherDraft(draft) : validateApplicationDraft(draft);
        setErrors(validation);
        if (Object.keys(validation).length)
            return;

        setSaving(true);
        setNotice('');
        const original = service;
        try {
            let savedService = null;
            await modifyConfiguration(current => {
                const index = current.services.findIndex(item => item?.id === original.id && item?.type === original.type);
                if (index === -1)
                    throw new Error('This launcher changed or was removed. Reload and try again.');
                const services = [...current.services];
                savedService = terminal
                    ? buildLauncherService(draft, services[index])
                    : buildApplicationService(draft, services[index]);
                services[index] = savedService;
                return { ...current, services };
            }, `Edited ${terminal ? 'terminal' : 'application'} launcher ${draft.name}`);

            try {
                if (terminal)
                    await stopTerminalLauncher(window.cockpit, original);
                else
                    await stopApplicationLauncher(window.cockpit, original);
            } catch (stopError) {
                setNotice(`Settings saved, but the old running launcher could not be stopped: ${messageFor(stopError)}`);
                onSaved?.(savedService);
                return;
            }

            onSaved?.(savedService);
            onClose?.();
        } catch (error) {
            setNotice(`Could not save launcher: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const terminal = isTerminal(service);
    const supported = terminal || isApplication(service);
    const formId = terminal ? 'terminal-launcher-editor-form' : 'application-launcher-editor-form';
    const title = terminal ? 'Edit terminal launcher' : 'Edit application launcher';

    return (
        <Modal isOpen={Boolean(service)} onClose={close} variant="medium">
            <ModalHeader title={draft?.name ? `${title}: ${draft.name}` : title} />
            <ModalBody>
                {notice && <Alert isInline variant={notice.startsWith('Settings saved') ? 'warning' : 'danger'} title={notice} />}
                {!supported && service && <Alert isInline variant="danger" title="This service type does not use a launcher editor." />}
                {draft && supported && (
                    <Form id={formId} onSubmit={save}>
                        {terminal ? (
                            <TerminalLauncherFields
                                draft={draft}
                                errors={errors}
                                onChange={update}
                                onProviderChange={updateProvider}
                                idPrefix="launcher-editor-terminal"
                                showGroup
                                showDerivedUrl
                            />
                        ) : (
                            <ApplicationLauncherFields
                                draft={draft}
                                errors={errors}
                                onChange={update}
                                idPrefix="launcher-editor-application"
                            />
                        )}
                    </Form>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" type="submit" form={formId} isDisabled={saving || !draft || !supported}>
                    {saving ? 'Saving…' : 'Save launcher'}
                </Button>
                <Button variant="link" onClick={close} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
