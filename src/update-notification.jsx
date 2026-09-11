import React, { useEffect, useState } from 'react';

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
        <div
            className="bookmarks-update-status"
            role="status"
            aria-live="polite"
            title={`Installed ${availableUpdate.installed}; update candidate ${availableUpdate.candidate}`}
        >
            <span>Cockpit Bookmarks update available: <strong>{availableUpdate.candidate}</strong></span>
            <span className="bookmarks-update-status-separator" aria-hidden="true">·</span>
            <button
                type="button"
                className="bookmarks-update-status-link"
                onClick={openUpdates}
            >
                Software Updates
            </button>
        </div>
    );
}
