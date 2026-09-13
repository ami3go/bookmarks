const MENU_SELECTOR = 'details.bookmark-action-menu';
const SOURCE_MENU_SELECTOR = '.bookmark-action-menu-list';
const MANAGEMENT_ACTIONS_SELECTOR = '.bookmarks-management-actions';
const VIEWPORT_PADDING = 8;
const MENU_GAP = 6;

const MANAGEMENT_LAUNCHERS = [
    {
        key: 'terminal-launchers',
        sourceSelector: '.gotty-launcher-manager-floating > button',
    },
    {
        key: 'discover-services',
        sourceSelector: '.bookmarks-discovery-floating > .bookmarks-discovery-launcher',
    },
];

let activeMenu = null;
let managementObserver = null;

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

function closeFloatingMenu({ focusTrigger = false } = {}) {
    if (!activeMenu)
        return;

    const { details, floating, trigger } = activeMenu;
    activeMenu = null;

    floating.remove();
    if (details.open)
        details.removeAttribute('open');
    if (focusTrigger)
        trigger.focus();
}

function positionFloatingMenu(floating, trigger) {
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = floating.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - menuRect.width - VIEWPORT_PADDING);

    let left = clamp(triggerRect.right - menuRect.width, VIEWPORT_PADDING, maxLeft);
    let top = triggerRect.bottom + MENU_GAP;

    if (top + menuRect.height > window.innerHeight - VIEWPORT_PADDING)
        top = triggerRect.top - menuRect.height - MENU_GAP;

    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - menuRect.height - VIEWPORT_PADDING);
    top = clamp(top, VIEWPORT_PADDING, maxTop);

    floating.style.left = `${Math.round(left)}px`;
    floating.style.top = `${Math.round(top)}px`;
}

function cloneMenu(sourceMenu, details, trigger) {
    const floating = document.createElement('div');
    floating.className = 'bookmark-floating-action-menu';
    floating.setAttribute('role', 'menu');
    floating.setAttribute('aria-label', trigger.getAttribute('aria-label') || 'Bookmark actions');

    for (const child of sourceMenu.children) {
        if (child.matches('button')) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = child.className;
            button.disabled = child.disabled;
            button.innerHTML = child.innerHTML;
            button.setAttribute('role', 'menuitem');
            button.addEventListener('click', event => {
                event.stopPropagation();
                child.click();
                closeFloatingMenu();
            });
            floating.appendChild(button);
            continue;
        }

        if (child.classList.contains('bookmark-action-menu-separator')) {
            const separator = child.cloneNode(true);
            separator.setAttribute('role', 'separator');
            floating.appendChild(separator);
        }
    }

    document.body.appendChild(floating);
    positionFloatingMenu(floating, trigger);

    const firstEnabled = floating.querySelector('button:not(:disabled)');
    firstEnabled?.focus({ preventScroll: true });

    activeMenu = { details, floating, trigger };
}

function openFloatingMenu(details) {
    const trigger = details.querySelector(':scope > summary');
    const sourceMenu = details.querySelector(`:scope > ${SOURCE_MENU_SELECTOR}`);
    if (!trigger || !sourceMenu) {
        details.removeAttribute('open');
        return;
    }

    if (activeMenu?.details === details)
        return;

    closeFloatingMenu();
    cloneMenu(sourceMenu, details, trigger);
}

function removeManagementProxy(key) {
    document.querySelector(`[data-bookmarks-management-proxy="${key}"]`)?.remove();
}

function syncManagementProxy(actions, definition) {
    const source = document.querySelector(definition.sourceSelector);
    let proxy = document.querySelector(`[data-bookmarks-management-proxy="${definition.key}"]`);

    if (!actions || !source) {
        proxy?.remove();
        return;
    }

    if (!proxy) {
        proxy = document.createElement('button');
        proxy.type = 'button';
        proxy.dataset.bookmarksManagementProxy = definition.key;
        proxy.addEventListener('click', () => {
            const currentSource = document.querySelector(definition.sourceSelector);
            if (currentSource && !currentSource.disabled)
                currentSource.click();
        });
        actions.appendChild(proxy);
    } else if (proxy.parentElement !== actions) {
        actions.appendChild(proxy);
    }

    if (proxy.className !== source.className)
        proxy.className = source.className;
    if (proxy.disabled !== source.disabled)
        proxy.disabled = source.disabled;
    if (proxy.innerHTML !== source.innerHTML)
        proxy.innerHTML = source.innerHTML;

    const ariaLabel = source.getAttribute('aria-label');
    if (ariaLabel && proxy.getAttribute('aria-label') !== ariaLabel)
        proxy.setAttribute('aria-label', ariaLabel);
    else if (!ariaLabel && proxy.hasAttribute('aria-label'))
        proxy.removeAttribute('aria-label');

    const title = source.getAttribute('title');
    if (title && proxy.getAttribute('title') !== title)
        proxy.setAttribute('title', title);
    else if (!title && proxy.hasAttribute('title'))
        proxy.removeAttribute('title');
}

function syncManagementLaunchers() {
    const actions = document.querySelector(MANAGEMENT_ACTIONS_SELECTOR);

    if (!actions) {
        for (const definition of MANAGEMENT_LAUNCHERS)
            removeManagementProxy(definition.key);
        return;
    }

    for (const definition of MANAGEMENT_LAUNCHERS)
        syncManagementProxy(actions, definition);
}

function installManagementLauncherSync() {
    if (managementObserver || !document.body)
        return;

    syncManagementLaunchers();
    managementObserver = new MutationObserver(syncManagementLaunchers);
    managementObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'disabled', 'aria-label', 'title'],
        characterData: true,
    });
}

document.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.matches(MENU_SELECTOR))
        return;

    if (details.open)
        openFloatingMenu(details);
    else if (activeMenu?.details === details)
        closeFloatingMenu();
}, true);

document.addEventListener('pointerdown', event => {
    if (!activeMenu)
        return;

    if (activeMenu.floating.contains(event.target) || activeMenu.details.contains(event.target))
        return;

    closeFloatingMenu();
}, true);

document.addEventListener('keydown', event => {
    if (!activeMenu)
        return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeFloatingMenu({ focusTrigger: true });
    }
}, true);

window.addEventListener('scroll', () => closeFloatingMenu(), true);
window.addEventListener('resize', () => closeFloatingMenu());

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', installManagementLauncherSync, { once: true });
else
    installManagementLauncherSync();
