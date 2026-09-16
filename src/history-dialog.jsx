import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { formatHistoryDate } from './bookmark-ui.js';

export function HistoryDialog({ isOpen, onClose, error, history, onRestore, editMode, saving }) {
    return (
        <Modal isOpen={isOpen} onClose={() => !saving && onClose()} variant="medium">
            <ModalHeader title="Configuration history" />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                {history.length === 0 ? (
                    <p>No history yet. A snapshot is saved automatically before each configuration change.</p>
                ) : (
                    <div className="bookmarks-history-list">
                        {[...history].reverse().map(entry => (
                            <div className="bookmarks-history-item" key={entry.id || `${entry.savedAt}-${entry.action}`}>
                                <div>
                                    <strong>{entry.action || 'Configuration changed'}</strong>
                                    <div>{formatHistoryDate(entry.savedAt)}</div>
                                    <div>{entry.config?.services?.length ?? 0} bookmarks</div>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => onRestore(entry)}
                                    isDisabled={saving || !editMode}
                                >
                                    Restore
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose} isDisabled={saving}>Close</Button>
            </ModalFooter>
        </Modal>
    );
}
