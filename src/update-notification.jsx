import React, { useEffect, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';

import { checkForPackageUpdate } from './update-check.js';

export function UpdateNotification() {
    const [availableUpdate, setAvailableUpdate] = useState(null);

    useEffect(() => {
        let active = true;

        checkForPackageUpdate(window.cockpit).then(update => {
            if (active)
                setAvailableUpdate(update);
        });

        return () => {
            active = false;
        };
    }, []);

    if (!availableUpdate)
        return null;

    const openUpdates = () => window.cockpit.jump('/updates');

    return (
        <div className="bookmarks-update-notification">
            <Alert
                isInline
                variant="info"
                title={`Cockpit Bookmarks ${availableUpdate.candidate} is available`}
            >
                <div className="bookmarks-update-notification-body">
                    <span>
                        Installed {availableUpdate.installed}. The host package manager reports {availableUpdate.candidate} as the upgrade candidate.
                    </span>
                    <Button variant="link" isInline onClick={openUpdates}>
                        Open Software Updates
                    </Button>
                </div>
            </Alert>
        </div>
    );
}
