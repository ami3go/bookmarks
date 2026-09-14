const HEADER_ACTIONS_CLASS = 'has-add-app';
const HEADER_ACTIONS_STYLE_ID = 'bookmarks-add-app-header-layout';

function sourceButton() {
    return document.querySelector('.application-launcher-manager-floating > button');
}

function addBookmarkButton() {
    return [...document.querySelectorAll('.bookmarks-header-actions > button')]
        .find(button => button.textContent.trim() === 'Add bookmark');
}

function installHeaderActionLayoutStyles() {
    if (document.getElementById(HEADER_ACTIONS_STYLE_ID))
        return;

    const style = document.createElement('style');
    style.id = HEADER_ACTIONS_STYLE_ID;
    style.textContent = `
.bookmarks-header-actions.${HEADER_ACTIONS_CLASS} {
    grid-template-columns: minmax(14rem, 1fr) minmax(9rem, auto) auto auto auto;
}

@media (max-width: 720px) {
    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} {
        grid-template-columns: 1fr auto auto;
    }

    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > :first-child,
    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} .bookmarks-group-filter {
        grid-column: 1 / -1;
    }
}
`;
    document.head.appendChild(style);
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

    installHeaderActionLayoutStyles();

    let proxy = null;
    let activeActions = null;

    const place = () => {
        const anchor = addBookmarkButton();
        const source = sourceButton();
        const actions = anchor?.closest('.bookmarks-header-actions') || null;

        if (activeActions && activeActions !== actions)
            activeActions.classList.remove(HEADER_ACTIONS_CLASS);
        activeActions = actions;

        if (!anchor || !source || !actions) {
            if (proxy?.isConnected)
                proxy.remove();
            return;
        }

        actions.classList.add(HEADER_ACTIONS_CLASS);

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
