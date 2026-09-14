import React, { useEffect, useRef, useState } from 'react';

import { modifyConfiguration, watchConfiguration } from './cockpit-config.js';
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
    const [allowed, setAllowed] = useState(false);
    const configRef = useRef(null);
    const migratingRef = useRef(false);

    useEffect(() => watchConfiguration(config => {
        configRef.current = config;
        if (!allowed || migratingRef.current || !needsMigration(config))
            return;
        migratingRef.current = true;
        modifyConfiguration(current => ({
            ...current,
            services: current.services.map(service => {
                if (service?.type !== TERMINAL_LAUNCHER_TYPE && service?.type !== APPLICATION_LAUNCHER_TYPE)
                    return service;
                if (String(service.group || '').trim() === APPLICATIONS_GROUP)
                    return service;
                return { ...service, group: APPLICATIONS_GROUP };
            }),
        }), 'Moved application launchers to Applications category')
            .catch(() => {})
            .finally(() => { migratingRef.current = false; });
    }), [allowed]);

    useEffect(() => {
        const permission = window.cockpit.permission({ admin: true });
        const update = () => setAllowed(permission.allowed === true);
        update();
        permission.addEventListener('changed', update);
        return () => {
            permission.removeEventListener('changed', update);
            permission.close();
        };
    }, []);

    useEffect(() => {
        const config = configRef.current;
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
    }, [allowed]);

    return null;
}
