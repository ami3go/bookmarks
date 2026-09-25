import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://mini-pc.local/',
    pretendToBeVisual: true,
});

function defineGlobal(name, value) {
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value,
    });
}

defineGlobal('window', dom.window);
defineGlobal('document', dom.window.document);
defineGlobal('navigator', dom.window.navigator);
defineGlobal('HTMLElement', dom.window.HTMLElement);
defineGlobal('Element', dom.window.Element);
defineGlobal('SVGElement', dom.window.SVGElement);
defineGlobal('HTMLInputElement', dom.window.HTMLInputElement);
defineGlobal('HTMLSelectElement', dom.window.HTMLSelectElement);
defineGlobal('Node', dom.window.Node);
defineGlobal('Event', dom.window.Event);
defineGlobal('CustomEvent', dom.window.CustomEvent);
defineGlobal('MouseEvent', dom.window.MouseEvent);
defineGlobal('KeyboardEvent', dom.window.KeyboardEvent);
defineGlobal('MutationObserver', dom.window.MutationObserver);
defineGlobal('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
defineGlobal('requestAnimationFrame', callback => setTimeout(() => callback(Date.now()), 0));
defineGlobal('cancelAnimationFrame', handle => clearTimeout(handle));
defineGlobal('ResizeObserver', class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
});

if (!dom.window.matchMedia) {
    dom.window.matchMedia = query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
    });
}

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/react');
const { DashboardHeader } = await import('../src/dashboard-header.jsx');
const { ServiceCard } = await import('../src/service-card.jsx');
const { useBookmarkManagement } = await import('../src/use-bookmark-management.js');
const { useDashboardView } = await import('../src/use-dashboard-view.js');
const { usePageSettings } = await import('../src/use-page-settings.js');

const BASE_CONFIG = {
    schemaVersion: 1,
    title: 'Services',
    subtitle: 'Local services',
    eyebrow: 'Mini PC',
    showEyebrow: true,
    showHeader: true,
    showTitle: true,
    showSearch: true,
    displayMode: 'cards',
    groupOrder: [],
    services: [],
    history: [],
};

afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete window.cockpit;
});

function CollapsedHarness({ config, loaded }) {
    const view = useDashboardView(config, loaded);
    return <output data-testid="collapsed">{JSON.stringify([...view.collapsedGroups])}</output>;
}

test('collapsed groups survive the placeholder configuration before the real file loads', async () => {
    window.localStorage.setItem('cockpit-bookmarks:collapsed-groups', JSON.stringify(['group:Applications']));
    const { rerender } = render(<CollapsedHarness config={BASE_CONFIG} loaded={false} />);
    assert.match(screen.getByTestId('collapsed').textContent, /group:Applications/);
    assert.equal(window.localStorage.getItem('cockpit-bookmarks:collapsed-groups'), '["group:Applications"]');

    const loadedConfig = {
        ...BASE_CONFIG,
        services: [{ id: 'one', name: 'One', url: 'http://one.test', group: 'Applications' }],
    };
    rerender(<CollapsedHarness config={loadedConfig} loaded />);
    await waitFor(() => assert.match(screen.getByTestId('collapsed').textContent, /group:Applications/));
});

function SettingsPreviewHarness() {
    const saved = {
        ...BASE_CONFIG,
        title: 'Saved hidden title',
        eyebrow: 'Saved eyebrow',
        showHeader: false,
        showTitle: false,
        showEyebrow: false,
        services: [{ id: 'one', name: 'Alpha', url: 'http://alpha.test', group: 'Applications' }],
    };
    const settings = usePageSettings(saved);
    const view = useDashboardView(settings.previewConfig, true, settings.open);
    return (
        <>
            <DashboardHeader
                config={settings.previewConfig}
                editMode
                previewSettings={settings.open}
                canEdit
                saving={false}
                query={view.query}
                setQuery={view.setQuery}
                groupFilter={view.groupFilter}
                setGroupFilter={view.setGroupFilter}
                groups={view.groups}
                onAddBookmark={() => {}}
                onAddApp={() => {}}
                onToggleEditMode={() => {}}
            />
            <button type="button" onClick={() => view.setQuery('does-not-match')}>Set hidden query</button>
            <button type="button" onClick={() => settings.openFor(saved)}>Open preview</button>
            <button type="button" onClick={() => settings.setDraft(current => ({
                ...current,
                title: 'Preview title',
                eyebrow: 'Preview eyebrow',
                showHeader: true,
                showTitle: true,
                showEyebrow: true,
                showSearch: false,
                displayMode: 'compact',
            }))}>Apply preview draft</button>
            <button type="button" onClick={settings.close}>Cancel preview</button>
            <output data-testid="compact">{String(view.compactMode)}</output>
            <output data-testid="visible-count">{String(view.services.length)}</output>
        </>
    );
}

test('page-settings preview reveals hidden header fields, previews density, and restores search filtering on cancel', async () => {
    render(<SettingsPreviewHarness />);
    assert.equal(screen.queryByRole('heading', { level: 1 }), null);
    fireEvent.click(screen.getByRole('button', { name: 'Set hidden query' }));
    await waitFor(() => assert.equal(screen.getByTestId('visible-count').textContent, '0'));

    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply preview draft' }));
    await waitFor(() => assert.equal(screen.getByRole('heading', { level: 1 }).textContent, 'Preview title'));
    assert.ok(screen.getByText('Preview eyebrow'));
    assert.equal(screen.queryByRole('searchbox', { name: 'Search bookmarks' }), null);
    assert.equal(screen.getByTestId('compact').textContent, 'true');
    assert.equal(screen.getByTestId('visible-count').textContent, '1');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel preview' }));
    await waitFor(() => assert.equal(screen.queryByRole('heading', { level: 1 }), null));
    assert.equal(screen.getByRole('searchbox', { name: 'Search bookmarks' }).value, 'does-not-match');
    assert.equal(screen.getByTestId('visible-count').textContent, '0');
});

test('ordinary service cards use a real link without nesting the actions control', () => {
    const service = {
        id: 'bookmark-one',
        sourceIndex: 0,
        name: 'Dashboard',
        url: 'http://dashboard.test',
        resolvedUrl: 'http://dashboard.test',
    };
    const { container } = render(
        <ServiceCard
            service={service}
            hostname="mini-pc.local"
            editMode={false}
            canEdit
            saving={false}
            isFavorites={false}
            canMoveUp={false}
            canMoveDown={false}
            selectedBookmark={null}
            dragSource={null}
            compactMode={false}
            onSelectService={() => {}}
            onOpenService={() => {}}
            onStopLauncher={() => {}}
            onRestartLauncher={() => {}}
            onViewOutput={() => {}}
            onSetSelectedBookmark={() => {}}
            onSetDragSource={() => {}}
            onReorderBetween={() => {}}
            onOpenEdit={() => {}}
            onToggleFavorite={() => {}}
            onDuplicateService={() => {}}
            onOpenMoveToGroup={() => {}}
            onMoveWithinGroup={() => {}}
            onRequestDelete={() => {}}
            onShowQr={() => {}}
        />
    );

    const link = screen.getByRole('link', { name: /Dashboard/ });
    assert.equal(link.getAttribute('href'), 'http://dashboard.test');
    assert.equal(link.getAttribute('target'), '_blank');
    assert.match(link.getAttribute('rel'), /noopener/);
    const actions = screen.getByRole('button', { name: 'Actions for Dashboard' });
    assert.equal(link.contains(actions), false);
    assert.equal(container.querySelector('.bookmark-card').getAttribute('role'), null);
});

function ManagementHarness() {
    const [query, setQuery] = React.useState('');
    const pageSettings = {
        open: false,
        draft: {
            title: BASE_CONFIG.title,
            subtitle: BASE_CONFIG.subtitle,
            eyebrow: BASE_CONFIG.eyebrow,
            showEyebrow: true,
            showHeader: true,
            showTitle: true,
            showSearch: true,
            displayMode: 'cards',
        },
        error: '',
        close() {},
        openFor() {},
        setOpen() {},
        setDraft() {},
        setError() {},
    };
    const view = {
        hostname: 'mini-pc.local',
        query,
        setQuery,
        groupFilter: 'all',
        setGroupFilter() {},
        groups: [],
        setDragSource() {},
    };
    const management = useBookmarkManagement({
        config: BASE_CONFIG,
        configError: null,
        configMissing: false,
        canEdit: true,
        view,
        pageSettings,
    });
    return (
        <>
            <button type="button" onClick={management.openAdd}>Open add</button>
            <button type="button" onClick={() => {
                management.updateDraft('name', 'Created through hook');
                management.updateDraft('url', 'http://created.test');
            }}>Fill draft</button>
            <button type="button" onClick={() => management.submitEditor({ preventDefault() {} })} disabled={!management.editor}>Save draft</button>
            <output data-testid="saving">{String(management.saving)}</output>
        </>
    );
}

test('useBookmarkManagement writes an added bookmark through a fake cockpit.file', async () => {
    let stored = { ...BASE_CONFIG };
    let replacedTag = null;
    window.cockpit = {
        message: error => error?.message || String(error),
        file: () => ({
            read: async () => [stored, 'tag-1'],
            replace: async (value, tag) => {
                stored = value;
                replacedTag = tag;
            },
            close() {},
        }),
    };

    render(<ManagementHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => assert.equal(stored.services.length, 1));
    assert.equal(replacedTag, 'tag-1');
    assert.equal(stored.services[0].name, 'Created through hook');
    assert.equal(stored.services[0].url, 'http://created.test');
});
