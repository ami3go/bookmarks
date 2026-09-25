import assert from 'node:assert/strict';
import test from 'node:test';

import { newBookmarkId } from '../src/bookmarks.js';
import { randomUuidFromValues } from '../src/secure-random-uuid.js';

test('cryptographic UUID fallback sets RFC 4122 version and variant bits', () => {
    const cryptoObject = {
        getRandomValues(bytes) {
            for (let index = 0; index < bytes.length; index += 1)
                bytes[index] = index;
            return bytes;
        },
    };

    assert.equal(randomUuidFromValues(cryptoObject), '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('newBookmarkId uses getRandomValues when randomUUID is unavailable', () => {
    const original = globalThis.crypto;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const cryptoObject = {
        getRandomValues(bytes) {
            bytes.fill(0x11);
            return bytes;
        },
    };

    try {
        Object.defineProperty(globalThis, 'crypto', { configurable: true, value: cryptoObject });
        assert.equal(newBookmarkId(), '11111111-1111-4111-9111-111111111111');
    } finally {
        if (descriptor)
            Object.defineProperty(globalThis, 'crypto', descriptor);
        else if (original === undefined)
            delete globalThis.crypto;
        else
            Object.defineProperty(globalThis, 'crypto', { configurable: true, value: original });
    }
});
