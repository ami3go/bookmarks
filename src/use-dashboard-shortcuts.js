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

            const active = document.activeElement;
            const grid = active?.closest?.('.bookmarks-grid');
            if (!grid)
                return;

            const cards = [...grid.querySelectorAll('.bookmark-card')]
                .filter(card => card instanceof HTMLElement && card.offsetParent !== null);
            if (!cards.length)
                return;

            const activeCard = active?.closest?.('.bookmark-card');
            const activeIndex = cards.indexOf(activeCard);
            if (activeIndex === -1)
                return;

            const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
            const nextIndex = (activeIndex + (forward ? 1 : -1) + cards.length) % cards.length;
            const nextCard = cards[nextIndex];
            const target = nextCard.matches('[tabindex]')
                ? nextCard
                : nextCard.querySelector('.bookmark-card-primary-link, .bookmark-launcher-primary');
            if (!target)
                return;

            event.preventDefault();
            target.focus();
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [query, setQuery, showSearch, managementOpen]);
}
