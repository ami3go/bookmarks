import { useCallback, useMemo, useState } from 'react';

import { normalizeConfig } from './bookmarks.js';
import { applyPageSettings, pageSettingsFrom } from './page-settings.js';

export function usePageSettings(config) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => pageSettingsFrom(config));
    const [error, setError] = useState('');

    const openFor = useCallback(current => {
        setDraft(pageSettingsFrom(current));
        setError('');
        setOpen(true);
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        setError('');
    }, []);

    const previewConfig = useMemo(() => {
        if (!open)
            return config;
        try {
            return normalizeConfig(applyPageSettings(config, draft));
        } catch (_) {
            return config;
        }
    }, [config, draft, open]);

    return {
        open,
        setOpen,
        draft,
        setDraft,
        error,
        setError,
        openFor,
        close,
        previewConfig,
    };
}
