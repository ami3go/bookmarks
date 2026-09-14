import React, { useEffect, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { useAdminPermission } from './app-providers.jsx';
import { modifyConfiguration, readConfiguration } from './cockpit-config.js';
import {
    GOTTY_LAUNCHER_PORT_END,
    GOTTY_LAUNCHER_PORT_START,
    findAvailableGoTTYLauncherPort,
} from './gotty-launcher-ports.js';
import { TerminalLauncherFields } from './launcher-form-fields.jsx';
import {
    TERMINAL_LAUNCHER_TYPE,
    buildLauncherService,
    defaultBinaryForProvider,
    launcherDraft,
    normalizeTerminalProvider,
    stopTerminalLauncher,
    terminalProviderLabel,
    validateLauncherDraft,
} from './terminal-launcher.js';

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

export function TerminalLauncherManager({ inline = false, visible = true, onOpenChange }) {
    const allowed = useAdminPermission();
    const [open, setOpen] = useState(false);
    const [launchers, setLaunchers] = useState([]);
    const [draft, setDraft] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const [allocatingPort, setAllocatingPort] = useState(false);

    useEffect(() => {
        if (allowed === false)
            setOpen(false);
    }, [allowed]);

    useEffect(() => {
        onOpenChange?.(open);
    }, [open, onOpenChange]);

    const refresh = async () => {
        const config = await readConfiguration();
        const current = launchersFrom(config);
        setLaunchers(current);
        return current;
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
            const current = await refresh();
            const port = await findAvailableGoTTYLauncherPort(window.cockpit, current);
            if (!port) {
                setNotice(`No free automatic terminal launcher port remains in ${GOTTY_LAUNCHER_PORT_START}-${GOTTY_LAUNCHER_PORT_END}.`);
                return;
            }
            const base = launcherDraft(null, port);
            setDraft({
                ...base,
                group: 'Applications',
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

    const save = async event => {
        event.preventDefault();
        const validation = validateLauncherDraft(draft);
        setErrors(validation);
        if (Object.keys(validation).length)
            return;

        setSaving(true);
        setNotice('');
        try {
            let original = null;
            await modifyConfiguration(current => {
                const services = [...current.services];
                const index = editingId ? services.findIndex(service => service?.id === editingId && service?.type === TERMINAL_LAUNCHER_TYPE) : -1;
                original = index >= 0 ? services[index] : null;
                const service = buildLauncherService({ ...draft, group: draft.group || 'Applications' }, original);
                if (index >= 0)
                    services[index] = service;
                else
                    services.push(service);
                return { ...current, services };
            }, editingId ? `Edited terminal launcher ${draft.name}` : `Added terminal launcher ${draft.name}`);

            if (original)
                await stopTerminalLauncher(window.cockpit, original).catch(() => {});
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

    if (allowed !== true)
        return null;

    return (
        <div className={inline ? 'terminal-launcher-manager-inline' : 'gotty-launcher-manager-floating'}>
            {visible && (
                <Button variant="secondary" onClick={openManager} isDisabled={saving || allocatingPort}>
                    Terminal launchers
                </Button>
            )}

            <Modal isOpen={open} onClose={() => !saving && !allocatingPort && setOpen(false)} variant="medium">
                <ModalHeader title="Terminal launchers" />
                <ModalBody>
                    {notice && <Alert isInline variant={notice.includes('Could not') || notice.includes('No free') ? 'danger' : 'info'} title={notice} />}

                    {!draft ? (
                        <>
                            <p className="gotty-launcher-intro">
                                On-demand terminal launchers start GoTTY or ttyd only when clicked and stop automatically after the configured runtime.
                            </p>
                            <div className="gotty-launcher-presets">
                                <Button variant="primary" onClick={() => beginNew(null)} isDisabled={saving || allocatingPort}>
                                    {allocatingPort ? 'Finding port…' : 'New terminal'}
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
                        <Form id="terminal-launcher-manager-form" onSubmit={save}>
                            <TerminalLauncherFields
                                draft={draft}
                                errors={errors}
                                onChange={update}
                                onProviderChange={updateProvider}
                                idPrefix="terminal-manager"
                                showGroup
                                showDerivedUrl={Boolean(editingId)}
                            />
                        </Form>
                    )}
                </ModalBody>
                <ModalFooter>
                    {draft ? (
                        <>
                            <Button variant="primary" type="submit" form="terminal-launcher-manager-form" isDisabled={saving}>
                                {saving ? 'Saving…' : (editingId ? 'Save launcher' : 'Add launcher')}
                            </Button>
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
