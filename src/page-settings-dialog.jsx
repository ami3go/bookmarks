import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import { DISPLAY_MODES } from './bookmarks.js';
import { CheckboxControl, SelectControl } from './form-controls.jsx';

const DISPLAY_MODE_OPTIONS = DISPLAY_MODES.map(mode => ({
    value: mode,
    label: mode === 'compact' ? 'Compact cards' : 'Standard cards',
}));

export function PageSettingsDialog({
    isOpen,
    onClose,
    error,
    draft,
    onChange,
    titleError,
    setTitleError,
    onSubmit,
    saving,
}) {
    return (
        <Modal isOpen={isOpen} onClose={() => !saving && onClose()} variant="medium">
            <ModalHeader title="Page settings" />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                <Form id="bookmark-settings-form" onSubmit={onSubmit}>
                    <FormGroup label="Title" isRequired fieldId="settings-title">
                        <TextInput
                            id="settings-title"
                            value={draft.title}
                            onChange={(_event, value) => {
                                onChange('title', value);
                                setTitleError('');
                            }}
                            validated={titleError ? 'error' : 'default'}
                        />
                        {titleError && <div className="bookmark-field-error">{titleError}</div>}
                    </FormGroup>
                    <FormGroup label="Subtitle" fieldId="settings-subtitle">
                        <TextInput
                            id="settings-subtitle"
                            value={draft.subtitle}
                            onChange={(_event, value) => onChange('subtitle', value)}
                        />
                    </FormGroup>
                    <FormGroup label="Eyebrow" fieldId="settings-eyebrow">
                        <TextInput
                            id="settings-eyebrow"
                            value={draft.eyebrow}
                            onChange={(_event, value) => onChange('eyebrow', value)}
                            isDisabled={!draft.showEyebrow}
                        />
                    </FormGroup>
                    <CheckboxControl
                        id="settings-show-eyebrow"
                        label="Show eyebrow above the page title"
                        isChecked={draft.showEyebrow}
                        onChange={checked => onChange('showEyebrow', checked)}
                    />
                    <FormGroup label="Visible page elements" fieldId="settings-show-header">
                        <div className="bookmarks-visibility-options">
                            <CheckboxControl
                                id="settings-show-header"
                                label="Show header"
                                isChecked={draft.showHeader}
                                onChange={checked => onChange('showHeader', checked)}
                            />
                            <CheckboxControl
                                id="settings-show-title"
                                label="Show title"
                                isChecked={draft.showTitle}
                                onChange={checked => onChange('showTitle', checked)}
                            />
                            <CheckboxControl
                                id="settings-show-search"
                                label="Show search bar"
                                isChecked={draft.showSearch}
                                onChange={checked => onChange('showSearch', checked)}
                            />
                        </div>
                        <div className="bookmark-field-help">
                            A hidden header is temporarily shown while Edit mode is active so administrators can always restore it.
                        </div>
                    </FormGroup>
                    <FormGroup label="Display density" fieldId="settings-display-mode">
                        <SelectControl
                            id="settings-display-mode"
                            value={draft.displayMode}
                            onChange={value => onChange('displayMode', value)}
                            options={DISPLAY_MODE_OPTIONS}
                        />
                        <div className="bookmark-field-help">
                            Compact cards fit more services on screen while keeping groups and management controls.
                        </div>
                    </FormGroup>
                </Form>
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" type="submit" form="bookmark-settings-form" isDisabled={saving}>
                    {saving ? 'Saving…' : 'Save settings'}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
