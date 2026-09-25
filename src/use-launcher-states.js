import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    LAUNCHER_STATE_CHANGED_EVENT,
    isLauncherService,
    launcherStates,
} from './service-runtime.js';

export function useLauncherStates(services, intervalMs = 15000) {
    const launchers = useMemo(() => (services || []).filter(isLauncherService), [services]);
    const [states, setStates] = useState(() => new Map());
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            setStates(await launcherStates(launchers));
        } finally {
            setRefreshing(false);
        }
    }, [launchers]);

    useEffect(() => {
        refresh();
        const onChanged = () => refresh();
        const onVisibility = () => {
            if (document.visibilityState === 'visible')
                refresh();
        };
        window.addEventListener(LAUNCHER_STATE_CHANGED_EVENT, onChanged);
        document.addEventListener('visibilitychange', onVisibility);
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                refresh();
        }, intervalMs);
        return () => {
            window.removeEventListener(LAUNCHER_STATE_CHANGED_EVENT, onChanged);
            document.removeEventListener('visibilitychange', onVisibility);
            window.clearInterval(timer);
        };
    }, [refresh, intervalMs]);

    return { states, refreshing, refresh };
}
