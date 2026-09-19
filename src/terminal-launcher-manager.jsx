import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { useAdminPermission } from './app-providers.jsx';
import { normalizeApplicationLauncher } from './application-launcher.js';
import { modifyConfiguration, readConfiguration } from './cockpit-config.js';
import { LauncherEditorDialog } from './launcher-editor-dialog.jsx';
import { LauncherOutputDialog } from './launcher-output-dialog.jsx';
import {
    isLauncherService,
    launcherStates,
    readServiceOutput,
    serviceKind,
    stopService,
} from './service-runtime.js';
import { normalizeTerminalLauncher, terminalProviderLabel } from './terminal-launcher.js';

function launcherTimeout(service) {
    const minutes = serviceKind(service) === 'terminal'
        ? normalizeTerminalLauncher(service.gottyLauncher).autoStopMinutes
        : normalizeApplicationLauncher(service.applicationLauncher).autoStopMinutes;
    return minutes > 0 ? `${minutes} min` : 'No timeout';
}

function launcherTypeLabel(service) {
    if (serviceKind(service) === 'terminal')
        return terminalProviderLabel(normalizeTerminalLauncher(service.gottyLauncher).provider);
    return 'Application';
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
    const [states, setStates] = useState(new Map());
    const [editing, setEditing] = useState(null);
    const [outputTarget, setOutputTarget] = useState(null);
    const [output, setOutput] = useState('');
    const [outputLoading, setOutputLoading] = useState(false);
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (allowed === false)
            setOpen(false);
    }, [allowed]);

    useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

    const refresh = async () => {
        const config = await readConfiguration();
        const current = (config.services || []).filter(isLauncherService);
        setLaunchers(current);
        setStates(await launcherStates(current));
        return current;
    };

    useEffect(() => {
        if (!open)
            return undefined;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                refresh().catch(() => {});
        }, 15000);
        return () => window.clearInterval(timer);
    }, [open]);

    const openManager = async () => {
        setNotice('');
        try {
            await refresh();
        } catch (error) {
            setNotice(`Could not load applications: ${messageFor(error)}`);
        }
        setOpen(true);
    };

    const stopLauncher = async service => {
        setSaving(true);
        setNotice('');
        try {
            await stopService(service);
            await refresh();
            setNotice(`${service.name || 'Launcher'} stopped.`);
        } catch (error) {
            setNotice(`Could not stop ${service.name || 'launcher'}: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const showOutput = async service => {
        setOutputTarget(service);
        setOutputLoading(true);
        try {
            setOutput(await readServiceOutput(service));
        } catch (error) {
            setOutput(`Could not read output: ${messageFor(error)}`);
        } finally {
            setOutputLoading(false);
        }
    };

    const removeLauncher = async service => {
        if (!window.confirm(`Delete ${service.name || 'this launcher'}?`))
            return;
        setSaving(true);
        setNotice('');
        let deleteAnyway = false;
        try {
            try {
                await stopService(service);
            } catch (error) {
                deleteAnyway = window.confirm(`Could not stop ${service.name || 'launcher'}: ${messageFor(error)}\n\nDelete the bookmark anyway? The process may remain running.`);
                if (!deleteAnyway)
                    return;
            }

            await modifyConfiguration(current => ({
                ...current,
                services: current.services.filter(item => item.id !== service.id),
            }), `Deleted ${service.name || 'launcher'}`);
            await refresh();
            setNotice(deleteAnyway ? 'Launcher bookmark deleted; the process may still be running.' : 'Launcher deleted.');
        } catch (error) {
            setNotice(`Could not delete launcher: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    const sortedLaunchers = useMemo(() => [...launchers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))), [launchers]);

    if (!visible)
        return null;

    return (
        <>
            <Button variant="secondary" onClick={openManager} isDisabled={allowed !== true || saving}>
                Applications
            </Button>
            <Modal isOpen={open} onClose={() => !saving && setOpen(false)} variant="medium">
                <ModalHeader title="Applications" />
                <ModalBody>
                    {notice && <Alert isInline variant={notice.startsWith('Could not') ? 'danger' : 'info'} title={notice} />}
                    <p className="bookmark-field-help">Create launchers with Add app. This manager controls existing terminal and application launchers.</p>
                    {!sortedLaunchers.length ? (
                        <div className="bookmarks-empty">No launchers configured.</div>
                    ) : (
                        <div className="bookmarks-history-list">
                            {sortedLaunchers.map(service => {
                                const state = states.get(service.id) || 'stopped';
                                return (
                                    <div className="bookmarks-history-item" key={service.id}>
                                        <div>
                                            <strong>{service.name || 'Unnamed launcher'}</strong>
                                            <div>{launcherTypeLabel(service)} · {state === 'running' ? 'Running' : state === 'failed' ? 'Failed' : 'Stopped'} · {launcherTimeout(service)}</div>
                                        </div>
                                        <div className="bookmarks-management-actions">
                                            <Button variant="secondary" onClick={() => stopLauncher(service)} isDisabled={saving || state === 'stopped'}>Stop</Button>
                                            <Button variant="secondary" onClick={() => showOutput(service)} isDisabled={saving}>View output</Button>
                                            <Button variant="secondary" onClick={() => setEditing(service)} isDisabled={saving}>Edit</Button>
                                            <Button variant="danger" onClick={() => removeLauncher(service)} isDisabled={saving}>Delete</Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => refresh().catch(error => setNotice(messageFor(error)))} isDisabled={saving}>Refresh</Button>
                    <Button variant="link" onClick={() => setOpen(false)} isDisabled={saving}>Close</Button>
                </ModalFooter>
            </Modal>

            <LauncherEditorDialog
                service={editing}
                onClose={() => setEditing(null)}
                onSaved={() => {
                    setEditing(null);
                    refresh().catch(() => {});
                }}
            />

            <LauncherOutputDialog
                target={outputTarget}
                output={output}
                loading={outputLoading}
                onRefresh={() => showOutput(outputTarget)}
                onClose={() => {
                    setOutputTarget(null);
                    setOutput('');
                }}
            />
        </>
    );
}
