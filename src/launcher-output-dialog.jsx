import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

export function LauncherOutputDialog({ target, output, loading, onRefresh, onClose }) {
    return (
        <Modal isOpen={target !== null} onClose={onClose} variant="medium">
            <ModalHeader title={target ? `${target.name || 'Launcher'} output` : 'Launcher output'} />
            <ModalBody>
                <p className="bookmark-field-help">Output is captured from the current launcher run in your private runtime directory.</p>
                <pre className="bookmarks-launcher-output">{loading ? 'Loading output…' : (output || 'No output has been captured for the current run.')}</pre>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onRefresh} isDisabled={loading || !target}>Refresh</Button>
                <Button variant="link" onClick={onClose}>Close</Button>
            </ModalFooter>
        </Modal>
    );
}
