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

if (!dom.window.scrollTo)
    dom.window.scrollTo = () => {};

const { cleanup, fireEvent, render, screen, within } = await import('@testing-library/react');
const { DashboardHeader } = await import('../src/dashboard-header.jsx');
const { PageSettingsDialog } = await import('../src/page-settings-dialog.jsx');
const { TerminalLauncherFields } = await import('../src/launcher-form-fields.jsx');

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
        displayMode: 'standard',
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

test('terminal auto-stop selector defaults to infinity and exposes fixed timeout choices', () => {
    const changes = [];
    const draft = {
        id: '',
        name: 'GoTTY Terminal',
        provider: 'gotty',
        binary: 'gotty',
        command: 'bash',
        args: '',
        port: '47200',
        address: '{host}',
        autoStopMinutes: '0',
        group: 'Applications',
        icon: '⌨️',
        accent: 'teal',
    };

    render(
        <TerminalLauncherFields
            draft={draft}
            onChange={(field, value) => changes.push([field, value])}
        />
    );

    const selector = screen.getByRole('combobox', { name: 'Auto-stop' });
    assert.equal(selector.value, '0');
    assert.deepEqual(
        within(selector).getAllByRole('option').map(option => option.textContent),
        ['∞ — No timeout', '10m', '30m', '1h', '3h', '8h']
    );

    fireEvent.change(selector, { target: { value: '180' } });
    assert.deepEqual(changes.at(-1), ['autoStopMinutes', '180']);
});
