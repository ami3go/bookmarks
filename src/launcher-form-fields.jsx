import React, { useMemo } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import {
    APPLICATION_LAUNCHER_PORT_END,
    APPLICATION_LAUNCHER_PORT_START,
} from './application-launcher-ports.js';
import {
    GOTTY_LAUNCHER_PORT_END,
    GOTTY_LAUNCHER_PORT_START,
} from './gotty-launcher-ports.js';
import {
    TERMINAL_PROVIDER_GOTTY,
    TERMINAL_PROVIDER_TTYD,
    defaultBinaryForProvider,
    isNetworkExposedAddress,
    launcherUrl,
    normalizeTerminalProvider,
    terminalProviderLabel,
} from './terminal-launcher.js';

const ACCENTS = [
    ['teal', 'Teal'],
    ['blue', 'Blue'],
    ['green', 'Green'],
    ['purple', 'Purple'],
    ['orange', 'Orange'],
    ['red', 'Red'],
    ['none', 'Default'],
];

function FieldError({ value }) {
    return value ? <div className="bookmark-field-error">{value}</div> : null;
}

function AccentField({ id, value, onChange }) {
    return (
        <FormGroup label="Card accent" fieldId={id}>
            <select id={id} className="bookmark-select" value={value} onChange={event => onChange(event.target.value)}>
                {ACCENTS.map(([optionValue, label]) => (
                    <option value={optionValue} key={optionValue}>{label}</option>
                ))}
            </select>
        </FormGroup>
    );
}

export function TerminalLauncherFields({
    draft,
    errors = {},
    onChange,
    onProviderChange,
    idPrefix = 'terminal-launcher',
    showGroup = true,
    showDerivedUrl = false,
}) {
    const provider = normalizeTerminalProvider(draft?.provider);
    const providerLabel = terminalProviderLabel(provider);
    const exposed = Boolean(draft && isNetworkExposedAddress(draft.address));
    const derivedUrl = draft?.id && draft?.port ? launcherUrl(draft.id, Number(draft.port)) : '';

    return (
        <>
            <FormGroup label="Application name" isRequired fieldId={`${idPrefix}-name`}>
                <TextInput id={`${idPrefix}-name`} value={draft.name} onChange={(_event, value) => onChange('name', value)} validated={errors.name ? 'error' : 'default'} />
                <FieldError value={errors.name} />
            </FormGroup>

            <FormGroup label="Terminal server" isRequired fieldId={`${idPrefix}-provider`}>
                <select
                    id={`${idPrefix}-provider`}
                    className="bookmark-select"
                    value={provider}
                    onChange={event => (onProviderChange || ((value) => onChange('provider', value)))(event.target.value)}
                >
                    <option value={TERMINAL_PROVIDER_GOTTY}>GoTTY</option>
                    <option value={TERMINAL_PROVIDER_TTYD}>ttyd</option>
                </select>
                <div className="bookmark-field-help">Existing launcher bookmarks without a provider are treated as GoTTY.</div>
            </FormGroup>

            <FormGroup label={`${providerLabel} executable`} isRequired fieldId={`${idPrefix}-binary`}>
                <TextInput
                    id={`${idPrefix}-binary`}
                    value={draft.binary}
                    onChange={(_event, value) => onChange('binary', value)}
                    placeholder={defaultBinaryForProvider(provider)}
                    validated={errors.binary ? 'error' : 'default'}
                />
                <FieldError value={errors.binary} />
                <div className="bookmark-field-help">An absolute path is recommended when the binary is not on the systemd user manager's PATH.</div>
            </FormGroup>

            <FormGroup label="Application command" isRequired fieldId={`${idPrefix}-command`}>
                <TextInput
                    id={`${idPrefix}-command`}
                    value={draft.command}
                    onChange={(_event, value) => onChange('command', value)}
                    placeholder="bash"
                    validated={errors.command ? 'error' : 'default'}
                />
                <FieldError value={errors.command} />
                <div className="bookmark-field-help">Examples: <code>bash</code>, <code>mc</code>, <code>btop</code>, <code>fish</code>, or an absolute executable path.</div>
            </FormGroup>

            <FormGroup label="Arguments" fieldId={`${idPrefix}-args`}>
                <TextArea
                    id={`${idPrefix}-args`}
                    value={draft.args}
                    onChange={(_event, value) => onChange('args', value)}
                    resizeOrientation="vertical"
                    placeholder={'--some-option\n/path/with spaces'}
                />
                <div className="bookmark-field-help">Optional. One argv entry per line. Arguments are passed directly without shell interpolation.</div>
            </FormGroup>

            <div className="gotty-launcher-grid">
                <FormGroup label="TCP port" isRequired fieldId={`${idPrefix}-port`}>
                    <TextInput id={`${idPrefix}-port`} type="number" value={draft.port} onChange={(_event, value) => onChange('port', value)} validated={errors.port ? 'error' : 'default'} />
                    <FieldError value={errors.port} />
                    <div className="bookmark-field-help">Automatic terminal launchers normally use {GOTTY_LAUNCHER_PORT_START}-{GOTTY_LAUNCHER_PORT_END}; any valid unprivileged port may be entered.</div>
                </FormGroup>
                <FormGroup label="Auto-stop minutes" isRequired fieldId={`${idPrefix}-auto-stop`}>
                    <TextInput id={`${idPrefix}-auto-stop`} type="number" value={draft.autoStopMinutes} onChange={(_event, value) => onChange('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                    <FieldError value={errors.autoStopMinutes} />
                </FormGroup>
            </div>

            <FormGroup label="Listen address" isRequired fieldId={`${idPrefix}-address`}>
                <TextInput id={`${idPrefix}-address`} value={draft.address} onChange={(_event, value) => onChange('address', value)} placeholder="{host}" validated={errors.address ? 'error' : 'default'} />
                <FieldError value={errors.address} />
                <div className="bookmark-field-help">Use <code>{'{host}'}</code> for the Cockpit hostname/IP, or <code>127.0.0.1</code> for local-only binding.</div>
            </FormGroup>

            {exposed && (
                <Alert isInline variant="warning" title="Writable terminal will be network-facing">
                    {providerLabel} starts with interactive input enabled. Only expose it on a trusted LAN/VPN or behind appropriate access controls.
                </Alert>
            )}

            {showGroup && (
                <div className="gotty-launcher-grid">
                    <FormGroup label="Group" fieldId={`${idPrefix}-group`}>
                        <TextInput id={`${idPrefix}-group`} value={draft.group} onChange={(_event, value) => onChange('group', value)} placeholder="Applications" />
                    </FormGroup>
                    <FormGroup label="Icon" fieldId={`${idPrefix}-icon`}>
                        <TextInput id={`${idPrefix}-icon`} value={draft.icon} onChange={(_event, value) => onChange('icon', value)} placeholder="⌨️" />
                    </FormGroup>
                </div>
            )}

            {!showGroup && (
                <FormGroup label="Icon" fieldId={`${idPrefix}-icon`}>
                    <TextInput id={`${idPrefix}-icon`} value={draft.icon} onChange={(_event, value) => onChange('icon', value)} placeholder="⌨️" />
                </FormGroup>
            )}

            <AccentField id={`${idPrefix}-accent`} value={draft.accent} onChange={value => onChange('accent', value)} />

            {showDerivedUrl && derivedUrl && (
                <FormGroup label="Derived launcher URL" fieldId={`${idPrefix}-url`}>
                    <TextInput id={`${idPrefix}-url`} value={derivedUrl} isReadOnly />
                    <div className="bookmark-field-help">The URL and base path are generated from the launcher ID and port and remain stable when switching terminal providers.</div>
                </FormGroup>
            )}
        </>
    );
}

function applicationNetworkFacing(draft) {
    const value = String(draft?.bindHost || '').trim().toLowerCase();
    return Boolean(draft) && !['127.0.0.1', 'localhost', '::1'].includes(value) && !value.startsWith('127.');
}

export function ApplicationLauncherFields({
    draft,
    errors = {},
    onChange,
    idPrefix = 'application-launcher',
}) {
    const networkFacing = useMemo(() => applicationNetworkFacing(draft), [draft]);

    return (
        <>
            <FormGroup label="Application name" isRequired fieldId={`${idPrefix}-name`}>
                <TextInput id={`${idPrefix}-name`} value={draft.name} onChange={(_event, value) => onChange('name', value)} validated={errors.name ? 'error' : 'default'} />
                <FieldError value={errors.name} />
            </FormGroup>

            <FormGroup label="Command" isRequired fieldId={`${idPrefix}-command`}>
                <TextInput id={`${idPrefix}-command`} value={draft.command} onChange={(_event, value) => onChange('command', value)} placeholder="/usr/local/bin/my-app" validated={errors.command ? 'error' : 'default'} />
                <FieldError value={errors.command} />
                <div className="bookmark-field-help">Absolute paths are recommended for systemd user services.</div>
            </FormGroup>

            <FormGroup label="Arguments" fieldId={`${idPrefix}-args`}>
                <TextArea id={`${idPrefix}-args`} value={draft.args} onChange={(_event, value) => onChange('args', value)} resizeOrientation="vertical" placeholder={'--host\n{bind}\n--port\n{port}'} />
                <div className="bookmark-field-help">One argv entry per line. Placeholders: <code>{'{host}'}</code>, <code>{'{bind}'}</code>, and <code>{'{port}'}</code>.</div>
            </FormGroup>

            <div className="gotty-launcher-grid">
                <FormGroup label="Bind host" isRequired fieldId={`${idPrefix}-bind-host`}>
                    <TextInput id={`${idPrefix}-bind-host`} value={draft.bindHost} onChange={(_event, value) => onChange('bindHost', value)} placeholder="0.0.0.0" validated={errors.bindHost ? 'error' : 'default'} />
                    <FieldError value={errors.bindHost} />
                </FormGroup>
                <FormGroup label="TCP port" isRequired fieldId={`${idPrefix}-port`}>
                    <TextInput id={`${idPrefix}-port`} type="number" value={draft.port} onChange={(_event, value) => onChange('port', value)} validated={errors.port ? 'error' : 'default'} />
                    <FieldError value={errors.port} />
                    <div className="bookmark-field-help">Automatic web applications normally use {APPLICATION_LAUNCHER_PORT_START}-{APPLICATION_LAUNCHER_PORT_END}.</div>
                </FormGroup>
            </div>

            {networkFacing && (
                <Alert isInline variant="warning" title="Application will be network-facing">
                    A wildcard or LAN bind exposes the application's HTTP server. Use application authentication and a trusted LAN/VPN or reverse proxy as appropriate.
                </Alert>
            )}

            <div className="gotty-launcher-grid">
                <FormGroup label="Auto-stop minutes" isRequired fieldId={`${idPrefix}-auto-stop`}>
                    <TextInput id={`${idPrefix}-auto-stop`} type="number" value={draft.autoStopMinutes} onChange={(_event, value) => onChange('autoStopMinutes', value)} validated={errors.autoStopMinutes ? 'error' : 'default'} />
                    <FieldError value={errors.autoStopMinutes} />
                </FormGroup>
                <FormGroup label="Startup timeout seconds" isRequired fieldId={`${idPrefix}-startup-timeout`}>
                    <TextInput id={`${idPrefix}-startup-timeout`} type="number" value={draft.startupTimeoutSeconds} onChange={(_event, value) => onChange('startupTimeoutSeconds', value)} validated={errors.startupTimeoutSeconds ? 'error' : 'default'} />
                    <FieldError value={errors.startupTimeoutSeconds} />
                </FormGroup>
            </div>

            <FormGroup label="Live URL command" fieldId={`${idPrefix}-url-command`}>
                <TextInput id={`${idPrefix}-url-command`} value={draft.urlCommand} onChange={(_event, value) => onChange('urlCommand', value)} placeholder="aoe" />
                <div className="bookmark-field-help">Optional command used to recover the browser URL when the application is already running.</div>
            </FormGroup>

            <FormGroup label="Live URL command arguments" fieldId={`${idPrefix}-url-args`}>
                <TextArea id={`${idPrefix}-url-args`} value={draft.urlArgs} onChange={(_event, value) => onChange('urlArgs', value)} resizeOrientation="vertical" placeholder="url" />
            </FormGroup>

            <FormGroup label="URL detection pattern" isRequired fieldId={`${idPrefix}-url-pattern`}>
                <TextInput id={`${idPrefix}-url-pattern`} value={draft.urlPattern} onChange={(_event, value) => onChange('urlPattern', value)} validated={errors.urlPattern ? 'error' : 'default'} />
                <FieldError value={errors.urlPattern} />
                <div className="bookmark-field-help">Regular expression applied to application output. The first capture group is used when present.</div>
            </FormGroup>

            <div className="gotty-launcher-grid">
                <FormGroup label="Icon" fieldId={`${idPrefix}-icon`}>
                    <TextInput id={`${idPrefix}-icon`} value={draft.icon} onChange={(_event, value) => onChange('icon', value)} placeholder="🚀" />
                </FormGroup>
                <AccentField id={`${idPrefix}-accent`} value={draft.accent} onChange={value => onChange('accent', value)} />
            </div>
        </>
    );
}
