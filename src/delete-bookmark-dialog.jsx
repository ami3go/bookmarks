import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { CONFIG_PATH } from './bookmarks.js';

export function DeleteBookmarkDialog({ target, onClose, error, onDelete, saving }) {
    return (
        <Modal isOpen={target !== null} onClose={() => !saving && onClose()} variant="small">
            <ModalHeader title="Delete bookmark?" titleIconVariant="danger" />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                {target && (
                    <p>
                        Delete <strong>{target.service.name || 'this bookmark'}</strong>? This removes it from {CONFIG_PATH}.
                    </p>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="danger" onClick={onDelete} isDisabled={saving}>
                    {saving ? 'Deleting…' : 'Delete'}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
