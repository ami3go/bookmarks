import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.jsx', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../src/index.jsx', import.meta.url), 'utf8');

test('launcher card editing is composed directly without DOM interception or custom edit events', () => {
    assert.match(app, /<LauncherEditorDialog/);
    assert.match(app, /setLauncherEditorService\(storedService\)/);
    assert.match(app, /storedService\.type === TERMINAL_LAUNCHER_TYPE/);
    assert.match(app, /storedService\.type === APPLICATION_LAUNCHER_TYPE/);
    assert.doesNotMatch(app, /dispatchEvent\(new CustomEvent\(TERMINAL_LAUNCHER_EDIT_EVENT/);
    assert.doesNotMatch(index, /<TerminalCardEditor/);
    assert.doesNotMatch(index, /<ApplicationCardEditor/);
    assert.doesNotMatch(index, /installTerminalLauncherOpenInterceptor/);
    assert.doesNotMatch(index, /installApplicationLauncherOpenInterceptor/);
});
