import assert from 'node:assert/strict';
import test from 'node:test';

import {
    APP_TYPE_AGENT_OF_EMPIRES,
    APP_TYPE_CUSTOM,
    APP_TYPE_GOTTY,
    APP_TYPE_TTYD,
    addAppTypeLabel,
    createAddAppDraft,
    isTerminalAddAppType,
    normalizeAddAppType,
} from '../src/add-app.js';

test('add-app type normalization and labels are stable', () => {
    assert.equal(normalizeAddAppType('ttyd'), APP_TYPE_TTYD);
    assert.equal(normalizeAddAppType('unknown'), APP_TYPE_CUSTOM);
    assert.equal(addAppTypeLabel(APP_TYPE_AGENT_OF_EMPIRES), 'Agent of Empires');
    assert.equal(isTerminalAddAppType(APP_TYPE_GOTTY), true);
    assert.equal(isTerminalAddAppType(APP_TYPE_TTYD), true);
    assert.equal(isTerminalAddAppType(APP_TYPE_CUSTOM), false);
});

test('custom application defaults preserve automatic application settings', () => {
    const draft = createAddAppDraft(APP_TYPE_CUSTOM, 47321);
    assert.equal(draft.name, 'Custom app');
    assert.equal(draft.port, '47321');
    assert.equal(draft.bindHost, '0.0.0.0');
    assert.equal(draft.autoStopMinutes, '120');
    assert.equal(draft.startupTimeoutSeconds, '20');
});

test('Agent of Empires preset is ready to launch', () => {
    const draft = createAddAppDraft(APP_TYPE_AGENT_OF_EMPIRES, 47322);
    assert.equal(draft.name, 'Agent of Empires');
    assert.equal(draft.command, 'aoe');
    assert.match(draft.args, /serve/);
    assert.match(draft.args, /\{port\}/);
    assert.equal(draft.urlCommand, 'aoe');
    assert.equal(draft.urlArgs, 'url');
    assert.equal(draft.port, '47322');
});

test('GoTTY preset uses terminal defaults and Cockpit host binding', () => {
    const draft = createAddAppDraft(APP_TYPE_GOTTY, 47221);
    assert.equal(draft.name, 'GoTTY Terminal');
    assert.equal(draft.provider, 'gotty');
    assert.equal(draft.binary, 'gotty');
    assert.equal(draft.command, 'bash');
    assert.equal(draft.address, '{host}');
    assert.equal(draft.port, '47221');
    assert.equal(draft.group, 'Applications');
});

test('ttyd preset switches provider and executable automatically', () => {
    const draft = createAddAppDraft(APP_TYPE_TTYD, 47222);
    assert.equal(draft.name, 'ttyd Terminal');
    assert.equal(draft.provider, 'ttyd');
    assert.equal(draft.binary, 'ttyd');
    assert.equal(draft.command, 'bash');
    assert.equal(draft.address, '{host}');
    assert.equal(draft.port, '47222');
    assert.equal(draft.group, 'Applications');
});
