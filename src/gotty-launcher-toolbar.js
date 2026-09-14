function findSourceButton() {
    return document.querySelector('.gotty-launcher-manager-floating > button');
}

function createProxyButton(source) {
    const button = source.cloneNode(true);
    button.removeAttribute('id');
    button.dataset.gottyLauncherToolbarAction = 'true';
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        findSourceButton()?.click();
    });
    return button;
}

export function installGoTTYLauncherToolbarPlacement() {
    if (window.__cockpitBookmarksGottyToolbarInstalled)
        return;
    window.__cockpitBookmarksGottyToolbarInstalled = true;

    let proxy = null;

    const place = () => {
        const actions = document.querySelector('.bookmarks-management-actions');
        const source = findSourceButton();

        if (!actions || !source) {
            if (proxy?.isConnected)
                proxy.remove();
            return;
        }

        if (!proxy || !proxy.isConnected)
            proxy = createProxyButton(source);

        proxy.disabled = source.disabled;
        proxy.setAttribute('aria-label', source.getAttribute('aria-label') || 'GoTTY launchers');
        proxy.title = source.title || '';

        if (proxy.parentElement !== actions || actions.firstElementChild !== proxy)
            actions.prepend(proxy);
    };

    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    place();
}
