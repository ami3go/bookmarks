import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import { ACCENT_PRESETS, ICON_PRESETS, OPEN_MODES, allowedUrl } from './bookmarks.js';
import { CheckboxControl, SelectControl } from './form-controls.jsx';

const OPEN_MODE_OPTIONS = OPEN_MODES.map(mode => ({
    value: mode,
    label: mode === 'same-tab' ? 'Same tab' : 'New tab',
}));

export function BookmarkEditorDialog({
    editor,
    onClose,
    error,
    onSubmit,
    warnings,
    draft,
    onChange,
    formErrors,
    resolvedPreview,
    groups,
    saving,
}) {
    return (
        <Modal isOpen={editor !== null} onClose={onClose} variant="medium">
            <ModalHeader title={editor?.mode === 'edit' ? 'Edit bookmark' : 'Add bookmark'} />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                <Form id="bookmark-editor-form" onSubmit={onSubmit}>
                    {warnings.length > 0 && (
                        <Alert isInline variant="warning" title="Possible duplicate">
                            {warnings.join(' ')}
                        </Alert>
                    )}
                    <FormGroup label="Name" isRequired fieldId="bookmark-name">
                        <TextInput
                            id="bookmark-name"
                            value={draft.name}
                            onChange={(_event, value) => onChange('name', value)}
                            isRequired
                            validated={formErrors.name ? 'error' : 'default'}
                        />
                        {formErrors.name && <div className="bookmark-field-error">{formErrors.name}</div>}
                    </FormGroup>
                    <FormGroup label="URL" isRequired fieldId="bookmark-url">
                        <TextInput
                            id="bookmark-url"
                            value={draft.url}
                            onChange={(_event, value) => onChange('url', value)}
                            placeholder="http://{host}:3000"
                            isRequired
                            validated={formErrors.url ? 'error' : 'default'}
                        />
                        {formErrors.url && <div className="bookmark-field-error">{formErrors.url}</div>}
                        {!formErrors.url && (
                            <div className="bookmark-field-help">
                                Use <code>{'{host}'}</code> for the Cockpit host name or IP address.
                                {resolvedPreview && allowedUrl(resolvedPreview) && (
                                    <div>Resolved URL: <code>{resolvedPreview}</code></div>
                                )}
                            </div>
                        )}
                    </FormGroup>
                    <FormGroup label="Alternate addresses" fieldId="bookmark-endpoints">
                        <TextArea
                            id="bookmark-endpoints"
                            value={draft.endpoints}
                            onChange={(_event, value) => onChange('endpoints', value)}
                            placeholder={'LAN | http://192.168.1.20:3000\nRemote | https://grafana.example.com'}
                            resizeOrientation="vertical"
                            validated={formErrors.endpoints ? 'error' : 'default'}
                        />
                        {formErrors.endpoints && <div className="bookmark-field-error">{formErrors.endpoints}</div>}
                        <div className="bookmark-field-help">
                            Optional. Add one address per line as <code>Label | URL</code>. The primary URL remains the default.
                        </div>
                    </FormGroup>
                    <FormGroup label="Open behavior" fieldId="bookmark-open-mode">
                        <SelectControl
                            id="bookmark-open-mode"
                            value={draft.openMode}
                            onChange={value => onChange('openMode', value)}
                            options={OPEN_MODE_OPTIONS}
                        />
                        <div className="bookmark-field-help">New tab is the default for existing bookmarks.</div>
                    </FormGroup>
                    <FormGroup label="Availability" fieldId="bookmark-status-check">
                        <CheckboxControl
                            id="bookmark-status-check"
                            label="Check whether this service is reachable from the Cockpit host"
                            isChecked={draft.statusCheck !== false}
                            onChange={checked => onChange('statusCheck', checked)}
                            description="Checks TCP reachability of the primary and alternate addresses. No HTTP credentials are sent."
                        />
                    </FormGroup>
                    <FormGroup label="Description" fieldId="bookmark-description">
                        <TextArea
                            id="bookmark-description"
                            value={draft.description}
                            onChange={(_event, value) => onChange('description', value)}
                            resizeOrientation="vertical"
                        />
                    </FormGroup>
                    <FormGroup label="Group" fieldId="bookmark-group">
                        <TextInput
                            id="bookmark-group"
                            value={draft.group}
                            onChange={(_event, value) => onChange('group', value)}
                            placeholder="Monitoring"
                        />
                        {groups.length > 0 && (
                            <div className="bookmark-field-help">Existing groups: {groups.filter(group => group !== 'Ungrouped').join(', ') || 'none'}.</div>
                        )}
                    </FormGroup>
                    <FormGroup label="Icon" fieldId="bookmark-icon">
                        <TextInput
                            id="bookmark-icon"
                            value={draft.icon}
                            onChange={(_event, value) => onChange('icon', value)}
                            placeholder="📊"
                        />
                        <div className="bookmark-icon-presets" aria-label="Common icons">
                            {ICON_PRESETS.map(icon => (
                                <Button
                                    variant="plain"
                                    type="button"
                                    className={draft.icon === icon ? 'is-selected' : ''}
                                    onClick={() => onChange('icon', icon)}
                                    aria-label={`Use ${icon} icon`}
                                    key={icon}
                                >
                                    {icon}
                                </Button>
                            ))}
                        </div>
                    </FormGroup>
                    <FormGroup label="Card accent" fieldId="bookmark-accent">
                        <div className="bookmark-accent-presets" aria-label="Card accent presets">
                            {ACCENT_PRESETS.map(option => (
                                <Button
                                    variant="plain"
                                    type="button"
                                    className={`bookmark-accent-choice accent-${option.value}${draft.accent === option.value ? ' is-selected' : ''}`}
                                    onClick={() => onChange('accent', option.value)}
                                    aria-label={`Use ${option.label} card accent`}
                                    title={option.label}
                                    key={option.value}
                                >
                                    <span aria-hidden="true" />
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </FormGroup>
                    <FormGroup label="Tags" fieldId="bookmark-tags">
                        <TextInput
                            id="bookmark-tags"
                            value={draft.tags}
                            onChange={(_event, value) => onChange('tags', value)}
                            placeholder="dashboard, monitoring"
                        />
                        <div className="bookmark-field-help">Separate tags with commas. Tags are searchable.</div>
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" type="submit" form="bookmark-editor-form" isDisabled={saving}>
                    {saving ? 'Saving…' : (editor?.mode === 'edit' ? 'Save changes' : 'Add bookmark')}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
