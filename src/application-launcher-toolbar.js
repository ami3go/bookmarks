function sourceButton() {
    return document.querySelector('.application-launcher-manager-floating > button');
}

function createProxy(source) {
    const button = source.cloneNode(true);
    button.removeAttribute('id');
    button.dataset.applicationLauncherToolbarAction = 'true';
    button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        sourceButton()?.click();
    });
    return button;
}

export function installApplicationLauncherToolbarPlacement() {
    if (window.__cockpitBookmarksApplicationToolbarInstalled)
        return;
    window.__cockpitBookmarksApplicationToolbarInstalled = true;

    let proxy = null;

    const place = () => {
        const actions = document.querySelector('.bookmarks-management-actions');
        const source = sourceButton();

        if (!actions || !source) {
            if (proxy?.isConnected)
                proxy.remove();
            return;
        }

        if (!proxy || !proxy.isConnected)
            proxy = createProxy(source);

        proxy.disabled = source.disabled;
        if (proxy.parentElement !== actions || actions.firstElementChild !== proxy)
            actions.prepend(proxy);
    };

    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    place();
}
