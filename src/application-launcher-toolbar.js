import { ADD_APP_EVENT } from './add-app.js';

const HEADER_ACTIONS_CLASS = 'has-add-app';
const HEADER_ACTIONS_STYLE_ID = 'bookmarks-add-app-header-layout';
const ADD_BOOKMARK_CLASS = 'bookmarks-add-bookmark-action';

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

.bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > .${ADD_BOOKMARK_CLASS} {
    grid-column: 3;
    grid-row: 1;
}

.bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > [data-application-launcher-toolbar-action="true"] {
    grid-column: 4;
    grid-row: 1;
}

.bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > .bookmark-edit-mode-toggle {
    grid-column: 5;
    grid-row: 1;
}

@media (max-width: 720px) {
    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} {
        grid-template-columns: minmax(0, 1fr) auto auto;
    }

    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > :first-child,
    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} .bookmarks-group-filter {
        grid-column: 1 / -1;
    }

    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > .${ADD_BOOKMARK_CLASS} {
        grid-column: 1;
        grid-row: 3;
        justify-self: end;
    }

    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > [data-application-launcher-toolbar-action="true"] {
        grid-column: 2;
        grid-row: 3;
    }

    .bookmarks-header-actions.${HEADER_ACTIONS_CLASS} > .bookmark-edit-mode-toggle {
        grid-column: 3;
        grid-row: 3;
        justify-self: end;
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
        window.dispatchEvent(new CustomEvent(ADD_APP_EVENT));
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
    let activeAnchor = null;

    const place = () => {
        const anchor = addBookmarkButton();
        const source = sourceButton();
        const actions = anchor?.closest('.bookmarks-header-actions') || null;

        if (activeActions && activeActions !== actions)
            activeActions.classList.remove(HEADER_ACTIONS_CLASS);
        activeActions = actions;

        if (activeAnchor && activeAnchor !== anchor)
            activeAnchor.classList.remove(ADD_BOOKMARK_CLASS);
        activeAnchor = anchor;

        if (!anchor || !source || !actions) {
            if (proxy?.isConnected)
                proxy.remove();
            return;
        }

        actions.classList.add(HEADER_ACTIONS_CLASS);
        anchor.classList.add(ADD_BOOKMARK_CLASS);

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
