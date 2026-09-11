export const SERVICE_STATES = ['online', 'offline', 'unknown'];

export function socketTarget(url) {
    try {
        const parsed = new URL(String(url || ''));
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            return null;

        const host = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
        const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
        if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
            return null;

        return { host, port };
    } catch (_) {
        return null;
    }
}

function messageFor(cockpit, error) {
    try {
        return cockpit?.message ? cockpit.message(error) : String(error || '');
    } catch (_) {
        return String(error || '');
    }
}

function missingProbeTool(cockpit, error) {
    return /(?:not found|no such file|enoent)/i.test(messageFor(cockpit, error));
}

export async function probeEndpoint(cockpit, endpoint) {
    const target = socketTarget(endpoint?.url);
    if (!target)
        return { state: 'unknown', reason: 'Invalid endpoint' };

    try {
        await cockpit.spawn([
            'timeout', '3', 'bash', '-c',
            'exec 3<>/dev/tcp/"$1"/"$2"',
            '_', target.host, String(target.port),
        ], { err: 'message' });
        return { state: 'online', endpointLabel: endpoint.label, url: endpoint.url };
    } catch (error) {
        if (missingProbeTool(cockpit, error))
            return { state: 'unknown', reason: 'Host TCP probe tools are unavailable' };
        return { state: 'offline', endpointLabel: endpoint.label, url: endpoint.url };
    }
}

export async function checkServiceStatus(cockpit, entry) {
    if (entry?.enabled === false)
        return { state: 'unknown', reason: 'Availability checking disabled' };

    const endpoints = Array.isArray(entry?.endpoints) ? entry.endpoints : [];
    if (endpoints.length === 0)
        return { state: 'unknown', reason: 'No valid endpoint' };

    let sawUnknown = false;
    let lastOffline = null;
    for (const endpoint of endpoints) {
        const result = await probeEndpoint(cockpit, endpoint);
        if (result.state === 'online')
            return result;
        if (result.state === 'unknown')
            sawUnknown = true;
        else
            lastOffline = result;
    }

    if (sawUnknown)
        return { state: 'unknown', reason: 'Endpoint status could not be determined' };
    return lastOffline || { state: 'offline' };
}

export async function checkServiceStatuses(cockpit, entries, concurrency = 4) {
    const services = Array.isArray(entries) ? entries : [];
    const results = {};
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, services.length || 1));

    const worker = async () => {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= services.length)
                return;
            const entry = services[index];
            results[entry.key] = await checkServiceStatus(cockpit, entry);
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

export function summarizeServiceStatuses(entries, statuses) {
    const summary = { total: 0, online: 0, offline: 0, unknown: 0 };
    for (const entry of Array.isArray(entries) ? entries : []) {
        summary.total += 1;
        const state = statuses?.[entry.key]?.state;
        if (state === 'online')
            summary.online += 1;
        else if (state === 'offline')
            summary.offline += 1;
        else
            summary.unknown += 1;
    }
    return summary;
}
