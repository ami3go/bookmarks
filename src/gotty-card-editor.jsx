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
    GOTTY_LAUNCHER_TYPE,
    buildLauncherService,
    isNetworkExposedAddress,
    launcherDraft,
    launcherUrl,
    stopGoTTYLauncher,
    validateLauncherDraft,
} from './gotty-launcher.js';
import {
    GOTTY_LAUNCHER_PORT_END,
    GOTTY_LAUNCHER_PORT_START,
} from './gotty-launcher-ports.js';

const EDIT_LABEL = 'Edit GoTTY launcher…';

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

    let candidates = config.services.filter(service => service?.type === GOTTY_LAUNCHER_TYPE);
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
            .find(button => button.textContent.trim() === 'Edit' || button.textContent.trim() === EDIT_LABEL);
        if (!editButton)
            return;

        editButton.dataset.gottyLauncherEdit = service.id;
        if (editButton.textContent.trim() !== EDIT_LABEL)
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

export function GoTTYCardEditor() {
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
        const update = () => setAllowed(permission.allowed === true);
        update();
        permission.addEventListener('changed', update);
        return () => {
            permission.removeEventListener('changed', update);
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
            if (!card)
                return;

            const launcher = launcherForRenderedCard(card, configRef.current);
            if (!launcher)
                return;
            if (button.textContent.trim() !== 'Edit' && button.textContent.trim() !== EDIT_LABEL)
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

    const update = (field, value) => {
        setDraft(current => ({ ...current, [field]: value }));
        setErrors(current => ({ ...current, [field]: undefined }));
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
                const index = current.services.findIndex(item => item?.id === original?.id && item?.type === GOTTY_LAUNCHER_TYPE);
                if (index === -1)
                    throw new Error('This GoTTY launcher changed or was removed. Reload and try again.');

                const services = [...current.services];
                services[index] = buildLauncherService(draft, services[index]);
                return { ...current, services };
            }, `Edited GoTTY launcher ${draft.name}`);

            try {
                await stopGoTTYLauncher(window.cockpit, original);
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
            <ModalHeader title={draft ? `Edit GoTTY launcher: ${draft.name || 'Unnamed'}` : 'Edit GoTTY launcher'} />
            <ModalBody>
                {notice && <Alert isInline variant={notice.startsWith('Settings saved') ? 'warning' : 'danger'} title={notice} />}
                {draft && (
                    <Form id="gotty-card-editor-form" onSubmit={save}>
                        <FormGroup label="Bookmark name" isRequired fieldId="gotty-card-name">
                            <TextInput id="gotty-card-name" value={draft.name} onChange={(_event, value) => update('name', value)} validated={errors.name ? 'error' : 'default'} />
                            {errors.name && <div className="bookmark-field-error">{errors.name}</div>}
                        </FormGroup>

                        <FormGroup label="GoTTY executable" isRequired fieldId="gotty-card-binary">
                            <TextInput id="gotty-card-binary" value={draft.binary} onChange={(_event, value) => update('binary', value)} placeholder="/usr/local/bin/gotty" validated={errors.binary ? 'error' : 'default'} />
                            {errors.binary && <div className="bookmark-field-error">{errors.binary}</div>}
                            <div className="bookmark-field-help">An absolute path is recommended for transient systemd user services, for example <code>/usr/local/bin/gotty</code>.</div>
                        </FormGroup>

                        <FormGroup label="Application command" isRequired fieldId="gotty-card-command">
                            <TextInput id="gotty-card-command" value={draft.command} onChange={(_event, value) => update('command', value)} placeholder="/usr/bin/fish" validated={errors.command ? 'error' : 'default'} />
                            {errors.command && <div className="bookmark-field-error">{errors.command}</div>}
                            <div className="bookmark-field-help">Examples: <code>/usr/bin/fish</code>, <code>/usr/bin/mc</code>, <code>/usr/bin/btop</code>, or another executable. Use <code>{'{host}'}</code> for the Cockpit host name or IP address.</div>
                        </FormGroup>

                        <FormGroup label="Application arguments" fieldId="gotty-card-args">
                            <TextArea id="gotty-card-args" value={draft.args} onChange={(_event, value) => update('args', value)} resizeOrientation="vertical" placeholder={'--option\n/path/with spaces'} />
                            <div className="bookmark-field-help">Optional. One argv entry per line. No shell expansion or <code>sh -c</code> is used. Use <code>{'{host}'}</code> for the Cockpit host name or IP address.</div>
                        </FormGroup>

                        <div className="gotty-launcher-grid">
                            <FormGroup label="TCP port" isRequired fieldId="gotty-card-port">
                                <TextInput id="gotty-card-port" type="number" value={draft.port} onChange={(_event, value) => update('port', value)} validated={errors.port ? 'error' : 'default'} />
                                {errors.port && <div className="bookmark-field-error">{errors.port}</div>}
                                <div className="bookmark-field-help">Automatic launchers normally use {GOTTY_LAUNCHER_PORT_START}-{GOTTY_LAUNCHER_PORT_END}, but a custom unprivileged port is allowed.</div>
                            </FormGroup>
                            <FormGroup label="Auto-stop minutes" isRequired fieldId="gotty-card-timeout">
                                <TextInput id="gotty-card-timeout" type="number" value={draft.autoStopMinutes} onChange={(_event, value) => update('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                                {errors.autoStopMinutes && <div className="bookmark-field-error">{errors.autoStopMinutes}</div>}
                            </FormGroup>
                        </div>

                        <FormGroup label="Listen address" isRequired fieldId="gotty-card-address">
                            <TextInput id="gotty-card-address" value={draft.address} onChange={(_event, value) => update('address', value)} placeholder="127.0.0.1" validated={errors.address ? 'error' : 'default'} />
                            {errors.address && <div className="bookmark-field-error">{errors.address}</div>}
                            <div className="bookmark-field-help">Use <code>127.0.0.1</code> for host-only access or a reachable LAN/VPN address when the browser is on another machine. Use <code>{'{host}'}</code> for the Cockpit host name or IP address.</div>
                        </FormGroup>
                        {exposed && (
                            <Alert isInline variant="warning" title="Writable terminal will be network-facing">
                                This launcher uses GoTTY interactive input. Only expose it on a trusted LAN/VPN or behind suitable access controls.
                            </Alert>
                        )}

                        <div className="gotty-launcher-grid">
                            <FormGroup label="Group" fieldId="gotty-card-group">
                                <TextInput id="gotty-card-group" value={draft.group} onChange={(_event, value) => update('group', value)} placeholder="Terminal" />
                            </FormGroup>
                            <FormGroup label="Icon" fieldId="gotty-card-icon">
                                <TextInput id="gotty-card-icon" value={draft.icon} onChange={(_event, value) => update('icon', value)} placeholder="⌨️" />
                            </FormGroup>
                        </div>

                        <FormGroup label="Card accent" fieldId="gotty-card-accent">
                            <select id="gotty-card-accent" className="bookmark-select" value={draft.accent} onChange={event => update('accent', event.target.value)}>
                                <option value="teal">Teal</option>
                                <option value="blue">Blue</option>
                                <option value="green">Green</option>
                                <option value="purple">Purple</option>
                                <option value="orange">Orange</option>
                                <option value="red">Red</option>
                                <option value="none">Default</option>
                            </select>
                        </FormGroup>

                        <FormGroup label="Derived launcher URL" fieldId="gotty-card-url">
                            <TextInput id="gotty-card-url" value={derivedUrl} isReadOnly />
                            <div className="bookmark-field-help">The URL and GoTTY base path are generated from the launcher ID and port so they stay consistent with startup behavior.</div>
                        </FormGroup>
                    </Form>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" type="submit" form="gotty-card-editor-form" isDisabled={saving}>
                    {saving ? 'Saving…' : 'Save launcher'}
                </Button>
                <Button variant="link" onClick={close} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
