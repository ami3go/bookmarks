import { useCallback, useEffect, useMemo, useState } from 'react';

import { normalizeConfig } from './bookmarks.js';
import { applyPageSettings, pageSettingsFrom } from './page-settings.js';

function settingsSignature(config) {
    return JSON.stringify(pageSettingsFrom(config));
}

export function usePageSettings(config) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => pageSettingsFrom(config));
    const [error, setError] = useState('');
    const [committedPreview, setCommittedPreview] = useState(null);

    const openFor = useCallback(current => {
        setDraft(pageSettingsFrom(current));
        setError('');
        setCommittedPreview(null);
        setOpen(true);
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        setError('');
        setCommittedPreview(null);
    }, []);

    const commit = useCallback(savedConfig => {
        setCommittedPreview(normalizeConfig(savedConfig));
        setOpen(false);
        setError('');
    }, []);

    useEffect(() => {
        if (committedPreview && settingsSignature(config) === settingsSignature(committedPreview))
            setCommittedPreview(null);
    }, [config, committedPreview]);

    const previewConfig = useMemo(() => {
        if (open) {
            try {
                return normalizeConfig(applyPageSettings(config, draft));
            } catch (_) {
                return config;
            }
        }
        return committedPreview || config;
    }, [committedPreview, config, draft, open]);

    return {
        open,
        setOpen,
        draft,
        setDraft,
        error,
        setError,
        openFor,
        close,
        commit,
        previewConfig,
    };
}
