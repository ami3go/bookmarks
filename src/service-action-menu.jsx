import React, { useState } from 'react';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider/index.js';
import { Dropdown, DropdownItem, DropdownList } from '@patternfly/react-core/dist/esm/components/Dropdown/index.js';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle/index.js';

import { isLauncherService } from './service-runtime.js';

async function copyAddress(value) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
}

export function ServiceActionMenu({
    service,
    selectedEndpoint,
    launcherState,
    editMode,
    canEdit,
    saving,
    canMoveUp,
    canMoveDown,
    onOpenService,
    onStopLauncher,
    onRestartLauncher,
    onViewOutput,
    onShowQr,
    onEdit,
    onToggleFavorite,
    onDuplicate,
    onMoveToGroup,
    onMoveWithinGroup,
    onDelete,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const launcher = isLauncherService(service);

    const select = action => event => {
        event?.stopPropagation?.();
        setIsOpen(false);
        action();
    };

    const toggle = toggleRef => (
        <MenuToggle
            ref={toggleRef}
            variant="plain"
            aria-label={`Actions for ${service.name || 'service'}`}
            isExpanded={isOpen}
            onClick={event => {
                event.stopPropagation();
                setIsOpen(open => !open);
            }}
        >
            <span aria-hidden="true">⋮</span>
        </MenuToggle>
    );

    return (
        <Dropdown
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            toggle={toggle}
            popperProps={{ position: 'right' }}
        >
            <DropdownList aria-label={`Actions for ${service.name || 'service'}`}>
                <DropdownItem
                    key="open"
                    onClick={select(() => onOpenService({
                        ...service,
                        resolvedUrl: selectedEndpoint.url,
                        openMode: 'new-tab',
                    }))}
                >
                    Open in new tab
                </DropdownItem>
                <DropdownItem key="copy" onClick={select(() => copyAddress(selectedEndpoint.url).catch(() => {}))}>
                    Copy URL
                </DropdownItem>
                <DropdownItem key="qr" onClick={select(onShowQr)}>
                    Show QR code
                </DropdownItem>

                {launcher && (
                    <>
                        <Divider key="launcher-divider" />
                        <DropdownItem
                            key="launcher-stop"
                            onClick={select(() => onStopLauncher(service))}
                            isDisabled={saving || launcherState === 'stopped'}
                        >
                            Stop
                        </DropdownItem>
                        <DropdownItem
                            key="launcher-restart"
                            onClick={select(() => onRestartLauncher(service))}
                            isDisabled={saving}
                        >
                            Restart
                        </DropdownItem>
                        <DropdownItem key="launcher-output" onClick={select(() => onViewOutput(service))} isDisabled={saving}>
                            View output
                        </DropdownItem>
                    </>
                )}

                {editMode && canEdit === true && (
                    <>
                        <Divider key="edit-divider" />
                        <DropdownItem key="edit" onClick={select(onEdit)} isDisabled={saving}>Edit</DropdownItem>
                        <DropdownItem key="favorite" onClick={select(onToggleFavorite)} isDisabled={saving}>
                            {service.favorite === true ? '★ Remove from Favorites' : '☆ Add to Favorites'}
                        </DropdownItem>
                        <DropdownItem key="duplicate" onClick={select(onDuplicate)} isDisabled={saving}>Duplicate</DropdownItem>
                        <DropdownItem key="move-group" onClick={select(onMoveToGroup)} isDisabled={saving}>Move to group…</DropdownItem>
                        <DropdownItem key="move-up" onClick={select(() => onMoveWithinGroup(-1))} isDisabled={!canMoveUp || saving}>
                            ↑ Move up
                        </DropdownItem>
                        <DropdownItem key="move-down" onClick={select(() => onMoveWithinGroup(1))} isDisabled={!canMoveDown || saving}>
                            ↓ Move down
                        </DropdownItem>
                        <Divider key="delete-divider" />
                        <DropdownItem key="delete" onClick={select(onDelete)} isDisabled={saving} isDanger>
                            Delete
                        </DropdownItem>
                    </>
                )}
            </DropdownList>
        </Dropdown>
    );
}
