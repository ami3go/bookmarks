import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://mini-pc.local/',
    pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = handle => clearTimeout(handle);
globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { DashboardHeader } = await import('../src/dashboard-header.jsx');
const { PageSettingsDialog } = await import('../src/page-settings-dialog.jsx');

const DEFAULT_HEADER_CONFIG = {
    showHeader: true,
    showTitle: true,
    showSearch: true,
    showEyebrow: true,
    eyebrow: 'Mini PC',
    title: 'Services',
    subtitle: 'Local services',
};

afterEach(() => cleanup());

test('dashboard header composes search, group filter, add actions, and edit toggle in one action container', () => {
    const calls = [];
    const { container } = render(
        <DashboardHeader
            config={DEFAULT_HEADER_CONFIG}
            editMode={false}
            canEdit
            saving={false}
            query=""
            setQuery={value => calls.push(['query', value])}
            groupFilter="all"
            setGroupFilter={value => calls.push(['group', value])}
            groups={['Applications', 'Monitoring']}
            onAddBookmark={() => calls.push(['add-bookmark'])}
            onAddApp={() => calls.push(['add-app'])}
            onToggleEditMode={() => calls.push(['edit'])}
        />
    );

    const actions = container.querySelector('.bookmarks-header-actions');
    assert.ok(actions);
    assert.equal(screen.getByRole('button', { name: 'Add bookmark' }).disabled, false);
    assert.equal(screen.getByRole('button', { name: 'Add app' }).disabled, false);
    assert.ok(screen.getByRole('button', { name: 'Enable edit mode' }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by group' }), { target: { value: 'Monitoring' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add app' }));
    assert.deepEqual(calls.slice(-2), [['group', 'Monitoring'], ['add-app']]);
});

test('dashboard header keeps management actions available when heading content is hidden', () => {
    render(
        <DashboardHeader
            config={{ ...DEFAULT_HEADER_CONFIG, showHeader: false, showTitle: false, showSearch: false }}
            editMode={false}
            canEdit
            saving={false}
            query=""
            setQuery={() => {}}
            groupFilter="all"
            setGroupFilter={() => {}}
            groups={[]}
            onAddBookmark={() => {}}
            onAddApp={() => {}}
            onToggleEditMode={() => {}}
        />
    );

    assert.equal(screen.queryByRole('heading', { level: 1 }), null);
    assert.ok(screen.getByRole('button', { name: 'Add bookmark' }));
    assert.ok(screen.getByRole('button', { name: 'Add app' }));
    assert.ok(screen.getByRole('button', { name: 'Enable edit mode' }));
});

test('page settings uses PatternFly controls and reports checkbox/select changes', () => {
    const changes = [];
    const draft = {
        title: 'Services',
        subtitle: '',
        eyebrow: 'Mini PC',
        showEyebrow: true,
        showHeader: true,
        showTitle: true,
        showSearch: true,
        displayMode: 'cards',
    };

    render(
        <PageSettingsDialog
            isOpen
            onClose={() => {}}
            error=""
            draft={draft}
            onChange={(field, value) => changes.push([field, value])}
            titleError=""
            setTitleError={() => {}}
            onSubmit={event => event.preventDefault()}
            saving={false}
        />
    );

    fireEvent.click(screen.getByLabelText('Show search bar'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Display density' }), { target: { value: 'compact' } });

    assert.deepEqual(changes, [
        ['showSearch', false],
        ['displayMode', 'compact'],
    ]);
});
