import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://mini-pc.local/',
    pretendToBeVisual: true,
});

function defineGlobal(name, value) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

defineGlobal('window', dom.window);
defineGlobal('document', dom.window.document);
defineGlobal('navigator', dom.window.navigator);
defineGlobal('HTMLElement', dom.window.HTMLElement);
defineGlobal('Element', dom.window.Element);
defineGlobal('SVGElement', dom.window.SVGElement);
defineGlobal('Node', dom.window.Node);
defineGlobal('MutationObserver', dom.window.MutationObserver);
defineGlobal('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
defineGlobal('requestAnimationFrame', callback => setTimeout(() => callback(Date.now()), 0));
defineGlobal('cancelAnimationFrame', handle => clearTimeout(handle));
defineGlobal('ResizeObserver', class ResizeObserver { observe() {} unobserve() {} disconnect() {} });

if (!dom.window.matchMedia) {
    dom.window.matchMedia = query => ({
        matches: false,
        media: query,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
    });
}

const { cleanup, render } = await import('@testing-library/react');
const { ServiceCard } = await import('../src/service-card.jsx');
let axe = null;
try {
    axe = (await import('axe-core')).default;
} catch (_) {
    // axe-core is installed as a pinned CI-only analysis dependency. A normal
    // local npm test remains usable without downloading extra analysis tools.
}

function cardProps(service) {
    return {
        service,
        status: { state: 'unknown' },
        hostname: 'mini-pc.local',
        editMode: false,
        canEdit: true,
        saving: false,
        isFavorites: false,
        canMoveUp: false,
        canMoveDown: false,
        selectedBookmark: null,
        dragSource: null,
        compactMode: false,
        onSelectService() {},
        onOpenService() {},
        onStopLauncher() {},
        onRestartLauncher() {},
        onViewOutput() {},
        onSetSelectedBookmark() {},
        onSetDragSource() {},
        onReorderBetween() {},
        onOpenEdit() {},
        onToggleFavorite() {},
        onDuplicateService() {},
        onOpenMoveToGroup() {},
        onMoveWithinGroup() {},
        onRequestDelete() {},
        onShowQr() {},
    };
}

test('service-card interactive structure passes axe', { skip: !axe }, async () => {
    const { container } = render(
        <div>
            <ServiceCard {...cardProps({
                id: 'plain',
                sourceIndex: 0,
                name: 'Dashboard',
                url: 'http://dashboard.test',
                resolvedUrl: 'http://dashboard.test',
            })} />
            <ServiceCard {...cardProps({
                id: 'terminal',
                sourceIndex: 1,
                type: 'gotty-launcher',
                name: 'Terminal',
                url: 'http://mini-pc.local:47200/cb-gotty-terminal/',
                resolvedUrl: 'http://mini-pc.local:47200/cb-gotty-terminal/',
                gottyLauncher: { provider: 'gotty', binary: 'gotty', command: 'bash', port: 47200, address: '{host}', autoStopMinutes: 0 },
            })} />
        </div>
    );

    const result = await axe.run(container, {
        rules: {
            'color-contrast': { enabled: false },
            region: { enabled: false },
        },
    });
    assert.deepEqual(
        result.violations.map(violation => ({ id: violation.id, impact: violation.impact })),
        []
    );
    cleanup();
});
