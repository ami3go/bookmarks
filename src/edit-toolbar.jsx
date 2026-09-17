import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';

import { ServiceDiscovery } from './service-discovery.jsx';
import { TerminalLauncherManager } from './terminal-launcher-manager.jsx';

export function EditToolbar({
    visible,
    historyCount,
    fileInputRef,
    onOpenSettings,
    onExport,
    onOpenHistory,
    onTerminalManagerOpenChange,
    onDiscoveryOpenChange,
}) {
    if (!visible)
        return null;

    return (
        <div className="bookmarks-management-bar">
            <div>
                <strong>Edit mode enabled.</strong>
                <span> Click a card to select it, or drag a card to reorder. Edit mode locks automatically after 2 minutes of inactivity.</span>
            </div>
            <div className="bookmarks-management-actions">
                <TerminalLauncherManager inline onOpenChange={onTerminalManagerOpenChange} />
                <ServiceDiscovery visible inline onOpenChange={onDiscoveryOpenChange} />
                <Button variant="secondary" onClick={onOpenSettings}>Page settings</Button>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Import JSON</Button>
                <Button variant="secondary" onClick={onExport}>Export JSON</Button>
                <Button variant="secondary" onClick={onOpenHistory}>
                    History ({historyCount})
                </Button>
            </div>
        </div>
    );
}
