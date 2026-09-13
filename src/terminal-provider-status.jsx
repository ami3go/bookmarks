import React, { useEffect, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';

import {
    checkTerminalProviderCompatibility,
    terminalProviderCompatibilityMessage,
} from './terminal-provider-compatibility.js';

export function TerminalProviderStatus({ provider, binary, compact = false }) {
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const executable = String(binary || '').trim();
        if (!executable) {
            setResult(null);
            setChecking(false);
            return undefined;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setChecking(true);
            try {
                const checked = await checkTerminalProviderCompatibility(window.cockpit, provider, executable);
                if (!cancelled)
                    setResult(checked);
            } finally {
                if (!cancelled)
                    setChecking(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [provider, binary]);

    if (checking && !result)
        return <div className="bookmark-field-help">Checking terminal server version and CLI compatibility…</div>;
    if (!result)
        return null;

    const variant = result.supported
        ? (result.versionVerified ? 'success' : 'warning')
        : 'danger';
    const message = terminalProviderCompatibilityMessage(result);

    if (compact) {
        return (
            <span className="bookmark-field-help" role="status">
                {result.supported ? '✓ ' : '⚠ '}{message}
            </span>
        );
    }

    return <Alert isInline variant={variant} title={message} />;
}
