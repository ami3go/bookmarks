from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "src/terminal-launcher.js",
    "export const TERMINAL_LAUNCHER_TYPE = GOTTY_LAUNCHER_TYPE;\nexport const GOTTY_LAUNCHER_PATH_PREFIX = '/cb-gotty-';",
    "export const TERMINAL_LAUNCHER_TYPE = GOTTY_LAUNCHER_TYPE;\nexport const TERMINAL_LAUNCHER_EDIT_EVENT = 'cockpit-bookmarks:edit-terminal-launcher';\nexport const GOTTY_LAUNCHER_PATH_PREFIX = '/cb-gotty-';",
)

replace_once(
    "src/app.jsx",
    "import { ServiceDiscovery } from './service-discovery.jsx';",
    "import { ServiceDiscovery } from './service-discovery.jsx';\nimport { TERMINAL_LAUNCHER_EDIT_EVENT, TERMINAL_LAUNCHER_TYPE } from './terminal-launcher.js';",
)

replace_once(
    "src/app.jsx",
    "        clearWriteError('editor');\n        setSelectedBookmark(serviceSelectionKey(service));\n        const storedService = runtimeFreeService(service);\n        setDraft(editableBookmark(storedService));\n        setFormErrors({});\n        setEditor({\n            mode: 'edit',\n            target: { index: service.sourceIndex, service: storedService },\n        });",
    "        clearWriteError('editor');\n        setSelectedBookmark(serviceSelectionKey(service));\n        const storedService = runtimeFreeService(service);\n\n        if (storedService.type === TERMINAL_LAUNCHER_TYPE) {\n            if (!storedService.id) {\n                setNotice({ variant: 'danger', text: 'This terminal launcher has no stable ID and cannot be edited safely.' });\n                return;\n            }\n            setEditor(null);\n            setFormErrors({});\n            window.dispatchEvent(new CustomEvent(TERMINAL_LAUNCHER_EDIT_EVENT, { detail: { id: storedService.id } }));\n            return;\n        }\n\n        setDraft(editableBookmark(storedService));\n        setFormErrors({});\n        setEditor({\n            mode: 'edit',\n            target: { index: service.sourceIndex, service: storedService },\n        });",
)

replace_once(
    "src/gotty-launcher-manager.jsx",
    "    GOTTY_LAUNCHER_TYPE,\n    buildLauncherService,",
    "    GOTTY_LAUNCHER_TYPE,\n    TERMINAL_LAUNCHER_EDIT_EVENT,\n    buildLauncherService,",
)

replace_once(
    "src/gotty-launcher-manager.jsx",
    "function cardIdentity(card) {\n    const titleSpans = card?.querySelectorAll?.('.bookmark-title-main > span') || [];\n    return {\n        name: titleSpans[1]?.textContent?.trim() || '',\n        description: card?.querySelector?.('.bookmark-description')?.textContent?.trim() || '',\n        section: card?.closest?.('.bookmark-group-section')?.querySelector?.('.bookmark-group-heading h2')?.textContent?.trim() || '',\n    };\n}\n\nfunction matchingLauncher(launchers, identity) {\n    const candidates = launchers.filter(service => {\n        if ((service?.name || '') !== identity.name)\n            return false;\n        if ((service?.description || '') !== identity.description)\n            return false;\n        if (identity.section && identity.section !== 'Favorites' && (service?.group || 'Ungrouped') !== identity.section)\n            return false;\n        return true;\n    });\n    return candidates.length === 1 ? candidates[0] : null;\n}\n\n",
    "",
)

old_effect = """    useEffect(() => {
        if (!allowed)
            return undefined;

        const passThrough = button => {
            button.dataset.gottyEditPassthrough = '1';
            button.click();
        };

        const handleEditClick = event => {
            const button = event.target?.closest?.('button.bookmark-action-menu-item');
            if (!button || button.textContent?.trim() !== 'Edit')
                return;

            if (button.dataset.gottyEditPassthrough === '1') {
                delete button.dataset.gottyEditPassthrough;
                return;
            }

            const card = button.closest('.bookmark-card');
            if (!card)
                return;

            const identity = cardIdentity(card);
            if (!identity.name || !identity.description)
                return;

            event.preventDefault();
            event.stopPropagation();

            readConfiguration()
                .then(config => {
                    const currentLaunchers = launchersFrom(config);
                    const service = matchingLauncher(currentLaunchers, identity);
                    if (!service) {
                        passThrough(button);
                        return;
                    }

                    setLaunchers(currentLaunchers);
                    beginEdit(service);
                    setOpen(true);
                })
                .catch(() => passThrough(button));
        };

        document.addEventListener('click', handleEditClick, true);
        return () => document.removeEventListener('click', handleEditClick, true);
    }, [allowed]);
"""

new_effect = """    useEffect(() => {
        const handleLauncherEdit = async event => {
            const id = String(event.detail?.id || '').trim();
            if (!id)
                return;

            setNotice('');
            setErrors({});
            setDraft(null);
            setEditingId(null);
            try {
                const config = await readConfiguration();
                const currentLaunchers = launchersFrom(config);
                setLaunchers(currentLaunchers);
                const service = currentLaunchers.find(item => item?.id === id);
                if (!service)
                    throw new Error('The terminal launcher no longer exists. Reload the dashboard and try again.');
                beginEdit(service);
                setOpen(true);
            } catch (error) {
                setNotice(`Could not open terminal launcher editor: ${messageFor(error)}`);
                setOpen(true);
            }
        };

        window.addEventListener(TERMINAL_LAUNCHER_EDIT_EVENT, handleLauncherEdit);
        return () => window.removeEventListener(TERMINAL_LAUNCHER_EDIT_EVENT, handleLauncherEdit);
    }, []);
"""

replace_once("src/gotty-launcher-manager.jsx", old_effect, new_effect)
