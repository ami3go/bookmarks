function sourceButton() {
    return document.querySelector('.application-launcher-manager-floating > button');
}

function addBookmarkButton() {
    return [...document.querySelectorAll('.bookmarks-header-actions > button')]
        .find(button => button.textContent.trim() === 'Add bookmark');
}

function createProxy(source) {
    const button = source.cloneNode(true);
    button.removeAttribute('id');
    button.textContent = 'Add app';
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
        const anchor = addBookmarkButton();
        const source = sourceButton();

        if (!anchor || !source) {
            if (proxy?.isConnected)
                proxy.remove();
            return;
        }

        if (!proxy || !proxy.isConnected)
            proxy = createProxy(source);

        proxy.disabled = source.disabled;
        if (anchor.nextElementSibling !== proxy)
            anchor.insertAdjacentElement('afterend', proxy);
    };

    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true });
    place();
}
