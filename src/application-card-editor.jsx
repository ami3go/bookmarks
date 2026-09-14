import React, { useEffect, useRef, useState } from 'react';

import { serviceGroup } from './bookmarks.js';
import { watchConfiguration } from './cockpit-config.js';
import {
    APPLICATION_LAUNCHER_EDIT_EVENT,
    APPLICATION_LAUNCHER_TYPE,
} from './application-launcher.js';

const EDIT_LABEL = 'Edit application launcher…';

function textAt(root, selector) {
    return root?.querySelector(selector)?.textContent?.trim() || '';
}

export function applicationForRenderedCard(card, config) {
    if (!card || !config?.services)
        return null;

    const name = textAt(card, '.bookmark-title-main > span:nth-child(2)');
    const icon = textAt(card, '.bookmark-icon');
    const description = textAt(card, '.bookmark-description');
    const section = card.closest('.bookmark-group-section');
    const renderedGroup = textAt(section, '.bookmark-group-heading h2');
    const favoritesSection = renderedGroup === 'Favorites';

    let candidates = config.services.filter(service => service?.type === APPLICATION_LAUNCHER_TYPE);
    if (favoritesSection)
        candidates = candidates.filter(service => service.favorite === true);
    else if (renderedGroup)
        candidates = candidates.filter(service => serviceGroup(service) === renderedGroup);

    if (name)
        candidates = candidates.filter(service => String(service.name || '').trim() === name);
    if (description)
        candidates = candidates.filter(service => String(service.description || '').trim() === description);
    if (icon)
        candidates = candidates.filter(service => String(service.icon || '↗').trim() === icon);

    return candidates.length === 1 ? candidates[0] : null;
}

function decorateApplicationCards(config) {
    document.querySelectorAll('.bookmark-card').forEach(card => {
        const service = applicationForRenderedCard(card, config);
        if (!service)
            return;
        const editButton = [...card.querySelectorAll('button.bookmark-action-menu-item')]
            .find(button => ['Edit', EDIT_LABEL].includes(button.textContent.trim()));
        if (!editButton)
            return;
        editButton.dataset.applicationLauncherEdit = service.id;
        editButton.textContent = EDIT_LABEL;
    });
}

export function ApplicationCardEditor() {
    const configRef = useRef(null);
    const [config, setConfig] = useState(null);
    const [allowed, setAllowed] = useState(false);

    useEffect(() => watchConfiguration(newConfig => {
        configRef.current = newConfig;
        setConfig(newConfig);
    }), []);

    useEffect(() => {
        const permission = window.cockpit.permission({ admin: true });
        const update = () => setAllowed(permission.allowed === true);
        update();
        permission.addEventListener('changed', update);
        return () => {
            permission.removeEventListener('changed', update);
            permission.close();
        };
    }, []);

    useEffect(() => {
        if (!config)
            return undefined;
        const decorate = () => decorateApplicationCards(configRef.current);
        decorate();
        const observer = new MutationObserver(decorate);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [config]);

    useEffect(() => {
        const interceptEdit = event => {
            if (!allowed)
                return;
            const button = event.target?.closest?.('button.bookmark-action-menu-item');
            if (!button || !['Edit', EDIT_LABEL].includes(button.textContent.trim()))
                return;
            const card = button.closest('.bookmark-card');
            const launcher = applicationForRenderedCard(card, configRef.current);
            if (!launcher)
                return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            button.closest('details')?.removeAttribute('open');
            window.dispatchEvent(new CustomEvent(APPLICATION_LAUNCHER_EDIT_EVENT, { detail: { id: launcher.id } }));
        };
        document.addEventListener('click', interceptEdit, true);
        return () => document.removeEventListener('click', interceptEdit, true);
    }, [allowed]);

    return null;
}
