import { useEffect } from 'react';

import { EDIT_MODE_TIMEOUT_MS } from './bookmarks.js';
import { typingTarget } from './bookmark-ui.js';

export function useEditModeTimeout(editMode, setEditMode, managementOpen) {
    useEffect(() => {
        if (!editMode || managementOpen)
            return undefined;

        let timer;
        const resetTimer = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setEditMode(false), EDIT_MODE_TIMEOUT_MS);
        };

        resetTimer();
        window.addEventListener('pointerdown', resetTimer);
        window.addEventListener('keydown', resetTimer);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('pointerdown', resetTimer);
            window.removeEventListener('keydown', resetTimer);
        };
    }, [editMode, managementOpen, setEditMode]);
}

export function useDashboardKeyboard({ query, setQuery, showSearch, managementOpen }) {
    useEffect(() => {
        const handleKeyboard = event => {
            if (managementOpen)
                return;

            const isTyping = typingTarget(event.target);
            if (event.key === '/' && !isTyping && showSearch) {
                const search = document.querySelector('.bookmarks-search input');
                if (search) {
                    event.preventDefault();
                    search.focus();
                    search.select?.();
                }
                return;
            }

            if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
                document.querySelector('.bookmarks-search input')?.focus();
                return;
            }

            if (isTyping || !['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key))
                return;

            const cards = [...document.querySelectorAll('.bookmark-card')]
                .filter(card => card instanceof HTMLElement && card.offsetParent !== null);
            if (cards.length === 0)
                return;

            const active = document.activeElement;
            const activeIndex = cards.indexOf(active);
            const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
            if (activeIndex === -1 && active !== document.body && !active?.matches?.('.bookmarks-page'))
                return;

            event.preventDefault();
            const nextIndex = activeIndex === -1
                ? (forward ? 0 : cards.length - 1)
                : (activeIndex + (forward ? 1 : -1) + cards.length) % cards.length;
            cards[nextIndex].focus();
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [query, setQuery, showSearch, managementOpen]);
}
