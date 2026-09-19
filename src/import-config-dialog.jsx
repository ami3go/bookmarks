import React, { useEffect, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import { CheckboxControl } from './form-controls.jsx';

export function ImportConfigDialog({ candidate, onClose, error, onConfirm, editMode, saving }) {
    const [trusted, setTrusted] = useState(false);
    const launchers = candidate?.importInfo?.launchers || [];

    useEffect(() => {
        setTrusted(false);
    }, [candidate]);

    const needsTrust = launchers.length > 0;

    return (
        <Modal isOpen={candidate !== null} onClose={() => !saving && onClose()} variant="medium">
            <ModalHeader title="Import configuration?" />
            <ModalBody>
                {error && <Alert isInline variant="danger" title={error} />}
                {candidate && (
                    <>
                        <p>
                            Replace the current configuration with <strong>{candidate.services.length}</strong> imported bookmarks?
                        </p>
                        <p>The current configuration will be kept in History before the import is applied.</p>

                        {needsTrust && (
                            <>
                                <Alert isInline variant="warning" title={`${launchers.length} imported launcher${launchers.length === 1 ? '' : 's'} can execute commands on this host`}>
                                    Review every command below. Importing a launcher stores the command, but compatibility checks no longer execute imported binaries automatically.
                                </Alert>
                                <div className="bookmarks-import-launchers">
                                    {launchers.map((launcher, index) => (
                                        <div className="bookmarks-import-launcher" key={launcher.id || `${launcher.name}-${index}`}>
                                            <strong>{launcher.name} · {launcher.kind}</strong>
                                            <code>{launcher.command}</code>
                                            <span>Bind: {launcher.bind} · Timeout: {launcher.timeout}</span>
                                            {launcher.writable === true && <span>Writable terminal input: enabled</span>}
                                            {launcher.binaryWarning && (
                                                <span className="bookmark-field-error">The configured terminal binary is not named gotty or ttyd.</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <CheckboxControl
                                    id="import-trust-launchers"
                                    label="I trust these launcher commands and want to import them"
                                    isChecked={trusted}
                                    onChange={setTrusted}
                                    isDisabled={saving}
                                />
                            </>
                        )}
                    </>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="primary" onClick={onConfirm} isDisabled={saving || !editMode || (needsTrust && !trusted)}>
                    {saving ? 'Importing…' : 'Import'}
                </Button>
                <Button variant="link" onClick={onClose} isDisabled={saving}>Cancel</Button>
            </ModalFooter>
        </Modal>
    );
}
