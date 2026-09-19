import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { MAX_CONFIG_SIZE } from './bookmarks.js';
import { formatHistoryDate } from './bookmark-ui.js';
import { configurationSizeBytes } from './cockpit-config.js';

function formatBytes(value) {
    if (value < 1024)
        return `${value} B`;
    if (value < 1024 * 1024)
        return `${(value / 1024).toFixed(1)} KiB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

export function HistoryDialog({ isOpen, onClose, error, config, onRestore, editMode, saving }) {
    const history = Array.isArray(config?.history) ? config.history : [];
    const size = config ? configurationSizeBytes(config) : 0;
    const percentage = MAX_CONFIG_SIZE > 0 ? Math.min(100, Math.round((size / MAX_CONFIG_SIZE) * 100)) : 0;

    return (
        <Modal isOpen={isOpen} onClose={() => !saving && onClose()} variant="medium">
            <ModalHeader title="Configuration history" />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                <p className="bookmark-field-help">
                    Configuration usage: <strong>{formatBytes(size)}</strong> of {formatBytes(MAX_CONFIG_SIZE)} ({percentage}%). Oldest history entries are trimmed automatically before a write exceeds the limit.
                </p>
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
                                <Button variant="secondary" onClick={() => onRestore(entry)} isDisabled={saving || !editMode}>Restore</Button>
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
