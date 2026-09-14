import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.jsx', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../src/index.jsx', import.meta.url), 'utf8');

test('launcher card editing is composed directly without DOM interception or custom edit events', () => {
    assert.match(app, /<LauncherEditorDialog/);
    assert.match(app, /function launcherEditorType\(service\)/);
    assert.match(app, /service\?\.type === TERMINAL_LAUNCHER_TYPE/);
    assert.match(app, /service\?\.type === APPLICATION_LAUNCHER_TYPE/);
    assert.match(app, /const launcherType = launcherEditorType\(storedService\)/);
    assert.match(app, /setLauncherEditorService\(storedService\)/);
    assert.doesNotMatch(app, /dispatchEvent\(new CustomEvent\(TERMINAL_LAUNCHER_EDIT_EVENT/);
    assert.doesNotMatch(index, /<TerminalCardEditor/);
    assert.doesNotMatch(index, /<ApplicationCardEditor/);
    assert.doesNotMatch(index, /installTerminalLauncherOpenInterceptor/);
    assert.doesNotMatch(index, /installApplicationLauncherOpenInterceptor/);
});
