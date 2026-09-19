export function randomUuidFromValues(cryptoObject = globalThis.crypto) {
    if (!cryptoObject?.getRandomValues)
        throw new Error('Secure random values are unavailable.');
    const bytes = new Uint8Array(16);
    cryptoObject.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export function ensureSecureRandomUuid(cryptoObject = globalThis.crypto) {
    if (!cryptoObject || typeof cryptoObject.randomUUID === 'function')
        return cryptoObject;
    if (typeof cryptoObject.getRandomValues !== 'function')
        return cryptoObject;
    try {
        Object.defineProperty(cryptoObject, 'randomUUID', {
            configurable: true,
            value: () => randomUuidFromValues(cryptoObject),
        });
    } catch (_) {
        // Some implementations expose a non-extensible Crypto object. Callers
        // can still use randomUuidFromValues directly in tests or utilities.
    }
    return cryptoObject;
}

ensureSecureRandomUuid();
