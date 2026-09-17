import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { serviceGroup } from './bookmarks.js';
import { SelectControl } from './form-controls.jsx';

export function MoveBookmarkDialog({
    target,
    onClose,
    error,
    groups,
    value,
    onChange,
    onMove,
    editMode,
    saving,
}) {
    const options = [...new Set(['Ungrouped', ...groups])].map(group => ({ value: group, label: group }));

    return (
        <Modal isOpen={target !== null} onClose={() => !saving && onClose()} variant="small">
            <ModalHeader title="Move bookmark to group" />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                {target && (
                    <FormGroup label={`Destination for ${target.service.name || 'bookmark'}`} fieldId="move-bookmark-group">
                        <SelectControl
                            id="move-bookmark-group"
                            value={value}
                            onChange={onChange}
                            options={options}
                        />
                    </FormGroup>
                )}
            </ModalBody>
            <ModalFooter>
                <Button
                    variant="primary"
                    onClick={onMove}
                    isDisabled={saving || !editMode || !target || serviceGroup(target.service) === value}
                >
                    {saving ? 'Moving…' : 'Move'}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
