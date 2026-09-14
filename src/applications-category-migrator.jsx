import React, { useEffect, useRef } from 'react';

import { useAdminPermission, useConfiguration } from './app-providers.jsx';
import { modifyConfiguration } from './cockpit-config.js';
import { APPLICATION_LAUNCHER_TYPE } from './application-launcher.js';
import { TERMINAL_LAUNCHER_TYPE } from './terminal-launcher.js';

const APPLICATIONS_GROUP = 'Applications';

function needsMigration(config) {
    return (config?.services || []).some(service =>
        (service?.type === TERMINAL_LAUNCHER_TYPE || service?.type === APPLICATION_LAUNCHER_TYPE) &&
        String(service.group || '').trim() !== APPLICATIONS_GROUP
    );
}

export function ApplicationsCategoryMigrator() {
    const { config } = useConfiguration();
    const allowed = useAdminPermission();
    const migratingRef = useRef(false);

    useEffect(() => {
        if (!allowed || migratingRef.current || !needsMigration(config))
            return;

        migratingRef.current = true;
        modifyConfiguration(current => ({
            ...current,
            services: current.services.map(service =>
                (service?.type === TERMINAL_LAUNCHER_TYPE || service?.type === APPLICATION_LAUNCHER_TYPE)
                    ? { ...service, group: APPLICATIONS_GROUP }
                    : service
            ),
        }), 'Moved application launchers to Applications category')
            .catch(() => {})
            .finally(() => { migratingRef.current = false; });
    }, [allowed, config]);

    return null;
}
