import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.jsx', import.meta.url), 'utf8');
const manager = fs.readFileSync(new URL('../src/terminal-launcher-manager.jsx', import.meta.url), 'utf8');

test('terminal launcher card Edit dispatches and handles the same edit event', () => {
    assert.match(app, /new CustomEvent\(TERMINAL_LAUNCHER_EDIT_EVENT/);
    assert.match(manager, /addEventListener\(TERMINAL_LAUNCHER_EDIT_EVENT, handleEditRequest\)/);
    assert.match(manager, /setDraft\(launcherDraft\(service\)\)/);
    assert.match(manager, /setEditingId\(service.id\)/);
});
