import { useEffect, useMemo, useState } from 'react';

import { serviceEndpoints } from './bookmarks.js';
import { checkServiceStatuses, summarizeServiceStatuses } from './service-status.js';

export function serviceStatusKey(service) {
    return service.id ? `id:${service.id}` : `legacy-index:${service.sourceIndex}`;
}

export function statusLabel(status) {
    if (status?.state === 'online')
        return status.endpointLabel && status.endpointLabel !== 'Primary'
            ? `Online · ${status.endpointLabel}`
            : 'Online';
    if (status?.state === 'offline')
        return 'Offline';
    return 'Unknown';
}

export function useServiceStatuses(services, hostname = window.location.hostname) {
    const [statuses, setStatuses] = useState({});
    const [refreshing, setRefreshing] = useState(false);

    const entries = useMemo(() => services.map((service, index) => ({
        key: serviceStatusKey({ ...service, sourceIndex: index }),
        enabled: service.statusCheck !== false,
        endpoints: serviceEndpoints(service, hostname),
    })), [services, hostname]);

    const refresh = async () => {
        setRefreshing(true);
        try {
            setStatuses(await checkServiceStatuses(window.cockpit, entries));
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        let active = true;
        setRefreshing(true);
        checkServiceStatuses(window.cockpit, entries)
            .then(result => {
                if (active)
                    setStatuses(result);
            })
            .finally(() => {
                if (active)
                    setRefreshing(false);
            });
        return () => { active = false; };
    }, [entries]);

    return {
        statuses,
        refreshing,
        refresh,
        summary: summarizeServiceStatuses(entries, statuses),
    };
}
