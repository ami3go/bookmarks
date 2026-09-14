import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sections = fs.readFileSync(new URL('../src/bookmark-sections.jsx', import.meta.url), 'utf8');
const manager = fs.readFileSync(new URL('../src/gotty-launcher-manager.jsx', import.meta.url), 'utf8');

test('GoTTY card Edit action routes to the launcher-specific editor', () => {
    assert.match(sections, /cockpit-bookmarks:edit-gotty-launcher/);
    assert.match(sections, /Edit GoTTY launcher/);
    assert.match(manager, /addEventListener\('cockpit-bookmarks:edit-gotty-launcher'/);
    assert.match(manager, /setDraft\(launcherDraft\(service\)\)/);
});
