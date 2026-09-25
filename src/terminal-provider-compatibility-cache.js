import { checkTerminalProviderCompatibility } from './terminal-provider-compatibility.js';

const compatibilityCache = new Map();

function cacheKey(provider, binary) {
    return `${String(provider || '').toLowerCase()}\0${String(binary || '').trim()}`;
}

export async function checkTerminalProviderCompatibilityCached(cockpit, provider, binary) {
    const key = cacheKey(provider, binary);
    if (!compatibilityCache.has(key)) {
        compatibilityCache.set(key, Promise.resolve(
            checkTerminalProviderCompatibility(cockpit, provider, binary)
        ).catch(error => {
            compatibilityCache.delete(key);
            throw error;
        }));
    }
    return compatibilityCache.get(key);
}

export function clearTerminalProviderCompatibilityCache() {
    compatibilityCache.clear();
}
