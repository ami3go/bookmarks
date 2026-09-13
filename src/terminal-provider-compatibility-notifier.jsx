import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';

import { watchConfiguration } from './cockpit-config.js';
import {
    TERMINAL_LAUNCHER_TYPE,
    normalizeTerminalLauncher,
} from './terminal-launcher.js';
import {
    checkTerminalProviderCompatibility,
    terminalProviderCompatibilityMessage,
} from './terminal-provider-compatibility.js';

function configuredProviders(config) {
    const unique = new Map();
    for (const service of config?.services || []) {
        if (service?.type !== TERMINAL_LAUNCHER_TYPE)
            continue;
        const launcher = normalizeTerminalLauncher(service.gottyLauncher);
        const key = `${launcher.provider}\0${launcher.binary}`;
        if (!unique.has(key))
            unique.set(key, { provider: launcher.provider, binary: launcher.binary });
    }
    return [...unique.values()];
}

export function TerminalProviderCompatibilityNotifier() {
    const [config, setConfig] = useState(null);
    const [results, setResults] = useState([]);

    useEffect(() => watchConfiguration(setConfig), []);

    const providers = useMemo(() => configuredProviders(config), [config]);
    const providerKey = useMemo(
        () => providers.map(item => `${item.provider}\0${item.binary}`).sort().join('\n'),
        [providers]
    );

    useEffect(() => {
        let cancelled = false;
        if (!providers.length) {
            setResults([]);
            return undefined;
        }

        Promise.all(providers.map(item => checkTerminalProviderCompatibility(
            window.cockpit,
            item.provider,
            item.binary
        ))).then(checked => {
            if (!cancelled)
                setResults(checked);
        });

        return () => {
            cancelled = true;
        };
    }, [providerKey]);

    const notices = results.filter(result => !result.supported || !result.versionVerified);
    if (!notices.length)
        return null;

    return (
        <div className="terminal-provider-compatibility-notices" aria-live="polite">
            {notices.map(result => (
                <Alert
                    isInline
                    variant={result.supported ? 'warning' : 'danger'}
                    title={terminalProviderCompatibilityMessage(result)}
                    key={`${result.provider}-${result.binary}`}
                />
            ))}
        </div>
    );
}
