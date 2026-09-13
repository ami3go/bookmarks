import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import { serviceGroup } from './bookmarks.js';
import { modifyConfiguration, watchConfiguration } from './cockpit-config.js';
import {
    TERMINAL_LAUNCHER_TYPE,
    TERMINAL_PROVIDER_GOTTY,
    TERMINAL_PROVIDER_TTYD,
    buildLauncherService,
    defaultBinaryForProvider,
    isNetworkExposedAddress,
    launcherDraft,
    launcherUrl,
    normalizeTerminalProvider,
    stopTerminalLauncher,
    terminalProviderLabel,
    validateLauncherDraft,
} from './terminal-launcher.js';
import { GOTTY_LAUNCHER_PORT_END, GOTTY_LAUNCHER_PORT_START } from './gotty-launcher-ports.js';

const EDIT_LABEL = 'Edit terminal launcher…';

function textAt(root, selector) {
    return root?.querySelector(selector)?.textContent?.trim() || '';
}

export function launcherForRenderedCard(card, config) {
    if (!card || !config?.services)
        return null;

    const name = textAt(card, '.bookmark-title-main > span:nth-child(2)');
    const icon = textAt(card, '.bookmark-icon');
    const description = textAt(card, '.bookmark-description');
    const section = card.closest('.bookmark-group-section');
    const renderedGroup = textAt(section, '.bookmark-group-heading h2');
    const favoritesSection = renderedGroup === 'Favorites';

    let candidates = config.services.filter(service => service?.type === TERMINAL_LAUNCHER_TYPE);
    if (favoritesSection)
        candidates = candidates.filter(service => service.favorite === true);
    else if (renderedGroup)
        candidates = candidates.filter(service => serviceGroup(service) === renderedGroup);

    if (name)
        candidates = candidates.filter(service => String(service.name || '').trim() === name);
    if (description)
        candidates = candidates.filter(service => String(service.description || '').trim() === description);
    if (icon)
        candidates = candidates.filter(service => String(service.icon || '↗').trim() === icon);

    return candidates.length === 1 ? candidates[0] : null;
}

function decorateLauncherCards(config) {
    document.querySelectorAll('.bookmark-card').forEach(card => {
        const service = launcherForRenderedCard(card, config);
        if (!service)
            return;
        const editButton = [...card.querySelectorAll('button.bookmark-action-menu-item')]
            .find(button => ['Edit', 'Edit GoTTY launcher…', EDIT_LABEL].includes(button.textContent.trim()));
        if (!editButton)
            return;
        editButton.dataset.terminalLauncherEdit = service.id;
        editButton.textContent = EDIT_LABEL;
    });
}

function messageFor(error) {
    try {
        return window.cockpit?.message ? window.cockpit.message(error) : String(error?.message || error || 'Unknown error');
    } catch (_) {
        return String(error?.message || error || 'Unknown error');
    }
}

export function TerminalCardEditor() {
    const [config, setConfig] = useState(null);
    const configRef = useRef(null);
    const [allowed, setAllowed] = useState(false);
    const [service, setService] = useState(null);
    const [draft, setDraft] = useState(null);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => watchConfiguration(newConfig => {
        configRef.current = newConfig;
        setConfig(newConfig);
    }), []);

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

    useEffect(() => {
        if (!config)
            return undefined;
        const decorate = () => decorateLauncherCards(configRef.current);
        decorate();
        const observer = new MutationObserver(decorate);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [config]);

    useEffect(() => {
        const interceptEdit = event => {
            if (!allowed)
                return;
            const button = event.target?.closest?.('button.bookmark-action-menu-item');
            if (!button)
                return;
            const card = button.closest('.bookmark-card');
            const launcher = launcherForRenderedCard(card, configRef.current);
            if (!launcher || !['Edit', 'Edit GoTTY launcher…', EDIT_LABEL].includes(button.textContent.trim()))
                return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            button.closest('details')?.removeAttribute('open');
            setService(launcher);
            setDraft(launcherDraft(launcher));
            setErrors({});
            setNotice('');
        };
        document.addEventListener('click', interceptEdit, true);
        return () => document.removeEventListener('click', interceptEdit, true);
    }, [allowed]);

    const exposed = useMemo(() => draft && isNetworkExposedAddress(draft.address), [draft]);
    const derivedUrl = draft?.id && draft?.port ? launcherUrl(draft.id, Number(draft.port)) : '';
    const providerLabel = terminalProviderLabel(draft?.provider);

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
            const binary = !current.binary || current.binary === oldDefault
                ? defaultBinaryForProvider(provider)
                : current.binary;
            return { ...current, provider, binary };
        });
        setErrors(current => ({ ...current, provider: undefined, binary: undefined }));
        setNotice('');
    };

    const resetEditor = () => {
        setService(null);
        setDraft(null);
        setErrors({});
        setNotice('');
    };

    const close = () => {
        if (!saving)
            resetEditor();
    };

    const save = async event => {
        event.preventDefault();
        const validation = validateLauncherDraft(draft);
        setErrors(validation);
        if (Object.keys(validation).length)
            return;

        setSaving(true);
        setNotice('');
        const original = service;
        try {
            await modifyConfiguration(current => {
                const index = current.services.findIndex(item => item?.id === original?.id && item?.type === TERMINAL_LAUNCHER_TYPE);
                if (index === -1)
                    throw new Error('This terminal launcher changed or was removed. Reload and try again.');
                const services = [...current.services];
                services[index] = buildLauncherService(draft, services[index]);
                return { ...current, services };
            }, `Edited terminal launcher ${draft.name}`);

            try {
                await stopTerminalLauncher(window.cockpit, original);
            } catch (stopError) {
                setNotice(`Settings saved, but the old running launcher could not be stopped: ${messageFor(stopError)}`);
                setService(null);
                setDraft(null);
                return;
            }
            resetEditor();
        } catch (error) {
            setNotice(`Could not save launcher: ${messageFor(error)}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={draft !== null} onClose={close} variant="medium">
            <ModalHeader title={draft ? `Edit terminal launcher: ${draft.name || 'Unnamed'}` : 'Edit terminal launcher'} />
            <ModalBody>
                {notice && <Alert isInline variant={notice.startsWith('Settings saved') ? 'warning' : 'danger'} title={notice} />}
                {draft && (
                    <Form id="terminal-card-editor-form" onSubmit={save}>
                        <FormGroup label="Bookmark name" isRequired fieldId="terminal-card-name">
                            <TextInput id="terminal-card-name" value={draft.name} onChange={(_event, value) => update('name', value)} validated={errors.name ? 'error' : 'default'} />
                            {errors.name && <div className="bookmark-field-error">{errors.name}</div>}
                        </FormGroup>

                        <FormGroup label="Terminal server" isRequired fieldId="terminal-card-provider">
                            <select id="terminal-card-provider" className="bookmark-select" value={normalizeTerminalProvider(draft.provider)} onChange={event => updateProvider(event.target.value)}>
                                <option value={TERMINAL_PROVIDER_GOTTY}>GoTTY</option>
                                <option value={TERMINAL_PROVIDER_TTYD}>ttyd</option>
                            </select>
                            <div className="bookmark-field-help">Existing launcher bookmarks without a provider are treated as GoTTY.</div>
                        </FormGroup>

                        <FormGroup label={`${providerLabel} executable`} isRequired fieldId="terminal-card-binary">
                            <TextInput id="terminal-card-binary" value={draft.binary} onChange={(_event, value) => update('binary', value)} placeholder={defaultBinaryForProvider(draft.provider)} validated={errors.binary ? 'error' : 'default'} />
                            {errors.binary && <div className="bookmark-field-error">{errors.binary}</div>}
                            <div className="bookmark-field-help">An absolute path is recommended for transient systemd user services.</div>
                        </FormGroup>

                        <FormGroup label="Application command" isRequired fieldId="terminal-card-command">
                            <TextInput id="terminal-card-command" value={draft.command} onChange={(_event, value) => update('command', value)} placeholder="/usr/bin/fish" validated={errors.command ? 'error' : 'default'} />
                            {errors.command && <div className="bookmark-field-error">{errors.command}</div>}
                        </FormGroup>

                        <FormGroup label="Application arguments" fieldId="terminal-card-args">
                            <TextArea id="terminal-card-args" value={draft.args} onChange={(_event, value) => update('args', value)} resizeOrientation="vertical" placeholder={'--option\n/path/with spaces'} />
                            <div className="bookmark-field-help">Optional. One argv entry per line. No shell expansion or <code>sh -c</code> is used.</div>
                        </FormGroup>

                        <div className="gotty-launcher-grid">
                            <FormGroup label="TCP port" isRequired fieldId="terminal-card-port">
                                <TextInput id="terminal-card-port" type="number" value={draft.port} onChange={(_event, value) => update('port', value)} validated={errors.port ? 'error' : 'default'} />
                                {errors.port && <div className="bookmark-field-error">{errors.port}</div>}
                                <div className="bookmark-field-help">Automatic launchers normally use {GOTTY_LAUNCHER_PORT_START}-{GOTTY_LAUNCHER_PORT_END}; custom unprivileged ports are allowed.</div>
                            </FormGroup>
                            <FormGroup label="Auto-stop minutes" isRequired fieldId="terminal-card-timeout">
                                <TextInput id="terminal-card-timeout" type="number" value={draft.autoStopMinutes} onChange={(_event, value) => update('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                                {errors.autoStopMinutes && <div className="bookmark-field-error">{errors.autoStopMinutes}</div>}
                            </FormGroup>
                        </div>

                        <FormGroup label="Listen address" isRequired fieldId="terminal-card-address">
                            <TextInput id="terminal-card-address" value={draft.address} onChange={(_event, value) => update('address', value)} placeholder="127.0.0.1" validated={errors.address ? 'error' : 'default'} />
                            {errors.address && <div className="bookmark-field-error">{errors.address}</div>}
                        </FormGroup>
                        {exposed && (
                            <Alert isInline variant="warning" title="Writable terminal will be network-facing">
                                This launcher starts {providerLabel} with interactive input enabled. Only expose it on a trusted LAN/VPN or behind suitable access controls.
                            </Alert>
                        )}

                        <div className="gotty-launcher-grid">
                            <FormGroup label="Group" fieldId="terminal-card-group">
                                <TextInput id="terminal-card-group" value={draft.group} onChange={(_event, value) => update('group', value)} placeholder="Terminal" />
                            </FormGroup>
                            <FormGroup label="Icon" fieldId="terminal-card-icon">
                                <TextInput id="terminal-card-icon" value={draft.icon} onChange={(_event, value) => update('icon', value)} placeholder="⌨️" />
                            </FormGroup>
                        </div>

                        <FormGroup label="Card accent" fieldId="terminal-card-accent">
                            <select id="terminal-card-accent" className="bookmark-select" value={draft.accent} onChange={event => update('accent', event.target.value)}>
                                <option value="teal">Teal</option><option value="blue">Blue</option><option value="green">Green</option>
                                <option value="purple">Purple</option><option value="orange">Orange</option><option value="red">Red</option><option value="none">Default</option>
                            </select>
                        </FormGroup>

                        <FormGroup label="Derived launcher URL" fieldId="terminal-card-url">
                            <TextInput id="terminal-card-url" value={derivedUrl} isReadOnly />
                            <div className="bookmark-field-help">The URL and launcher base path are generated from the launcher ID and port and remain stable when switching providers.</div>
                        </FormGroup>
                    </Form>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" type="submit" form="terminal-card-editor-form" isDisabled={saving}>{saving ? 'Saving…' : 'Save launcher'}</Button>
                <Button variant="link" onClick={close} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
