import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

export function ImportConfigDialog({ candidate, onClose, error, onConfirm, editMode, saving }) {
    return (
        <Modal isOpen={candidate !== null} onClose={() => !saving && onClose()} variant="small">
            <ModalHeader title="Import configuration?" />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                {candidate && (
                    <>
                        <p>
                            Replace the current configuration with <strong>{candidate.services.length}</strong> imported bookmarks?
                        </p>
                        <p>The current configuration will be kept in History before the import is applied.</p>
                    </>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={onConfirm} isDisabled={saving || !editMode}>
                    {saving ? 'Importing…' : 'Import'}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
