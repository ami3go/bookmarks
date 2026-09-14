import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { CONFIG_PATH, DEFAULT_CONFIG } from './bookmarks.js';
import { watchConfiguration } from './cockpit-config.js';

const ConfigurationContext = createContext(null);
const PermissionContext = createContext(null);

export function AppProviders({ children }) {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [configError, setConfigError] = useState(null);
    const [configMissing, setConfigMissing] = useState(false);
    const [canEdit, setCanEdit] = useState(null);

    useEffect(() => watchConfiguration(
        value => {
            setConfig(value);
            setConfigError(null);
            setConfigMissing(false);
        },
        error => setConfigError(error),
        () => setConfigMissing(true)
    ), []);

    useEffect(() => {
        const permission = window.cockpit.permission({ admin: true });
        const update = () => setCanEdit(permission.allowed === true);
        update();
        permission.addEventListener('changed', update);
        return () => {
            permission.removeEventListener('changed', update);
            permission.close();
        };
    }, []);

    const configurationValue = useMemo(() => ({
        config,
        configError,
        configMissing,
        configPath: CONFIG_PATH,
    }), [config, configError, configMissing]);

    return (
        <PermissionContext.Provider value={canEdit}>
            <ConfigurationContext.Provider value={configurationValue}>
                {children}
            </ConfigurationContext.Provider>
        </PermissionContext.Provider>
    );
}

export function useConfiguration() {
    const value = useContext(ConfigurationContext);
    if (!value)
        throw new Error('useConfiguration must be used inside AppProviders.');
    return value;
}

export function useAdminPermission() {
    const value = useContext(PermissionContext);
    if (value === null)
        return null;
    return value === true;
}
