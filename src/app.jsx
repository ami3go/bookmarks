import React, { useEffect, useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card/index.js';
import { Page } from '@patternfly/react-core/dist/esm/components/Page/index.js';

const CONFIG_PATH = '/etc/cockpit/cockpit-bookmarks.json';

function miniPcHost() {
    const hostname = window.location.hostname;
    return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}

function expandUrl(url) {
    return String(url || '').replaceAll('{host}', miniPcHost());
}

function allowedUrl(url) {
    try {
        const parsed = new URL(url, window.location.href);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function normalizeConfig(config) {
    if (!config || typeof config !== 'object' || !Array.isArray(config.services))
        throw new Error('Configuration must contain a services array.');

    return {
        title: config.title || 'Cockpit Bookmarks',
        subtitle: config.subtitle || 'Services hosted on this mini PC',
        services: config.services,
    };
}

export const Application = () => {
    const [config, setConfig] = useState({
        title: 'Cockpit Bookmarks',
        subtitle: 'Services hosted on this mini PC',
        services: [],
    });
    const [query, setQuery] = useState('');
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        const file = window.cockpit.file(CONFIG_PATH, { syntax: JSON, max_read_size: 262144 });
        let active = true;

        file.read()
            .then(content => {
                if (!active)
                    return;

                if (content === null) {
                    setNotice({
                        variant: 'info',
                        text: `No configuration found. Create ${CONFIG_PATH}.`,
                    });
                    return;
                }

                setConfig(normalizeConfig(content));
            })
            .catch(error => {
                if (!active)
                    return;
                setNotice({
                    variant: 'danger',
                    text: `Could not load ${CONFIG_PATH}: ${window.cockpit.message(error)}`,
                });
            });

        return () => {
            active = false;
            file.close();
        };
    }, []);

    const services = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return config.services
            .map(service => ({ ...service, resolvedUrl: expandUrl(service.url) }))
            .filter(service => allowedUrl(service.resolvedUrl))
            .filter(service => {
                if (!needle)
                    return true;
                const haystack = `${service.name || ''} ${service.description || ''} ${service.group || ''} ${service.url || ''}`.toLowerCase();
                return haystack.includes(needle);
            });
    }, [config.services, query]);

    return (
        <Page className="pf-m-no-sidebar">
            <main className="bookmarks-page">
                <header className="bookmarks-header">
                    <div>
                        <p className="bookmarks-eyebrow">Mini PC</p>
                        <h1>{config.title}</h1>
                        <p className="bookmarks-subtitle">{config.subtitle}</p>
                    </div>
                    <label className="bookmarks-search">
                        <span>Filter services</span>
                        <input
                            type="search"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search bookmarks…"
                            autoComplete="off"
                        />
                    </label>
                </header>

                {notice && (
                    <Alert
                        isInline
                        variant={notice.variant}
                        title={notice.text}
                        className="bookmarks-notice"
                    />
                )}

                {services.length > 0 ? (
                    <section className="bookmarks-grid" aria-label="Service bookmarks">
                        {services.map((service, index) => (
                            <a
                                className="bookmark-link"
                                href={service.resolvedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                key={`${service.name || 'service'}-${service.resolvedUrl}-${index}`}
                            >
                                <Card className="bookmark-card">
                                    <CardTitle>
                                        <span className="bookmark-icon" aria-hidden="true">{service.icon || '↗'}</span>
                                        <span>{service.name || 'Unnamed service'}</span>
                                    </CardTitle>
                                    <CardBody>
                                        <p className="bookmark-description">{service.description || service.resolvedUrl}</p>
                                        <div className="bookmark-meta">
                                            {service.group && <span className="bookmark-group">{service.group}</span>}
                                            <span className="bookmark-open">Open ↗</span>
                                        </div>
                                    </CardBody>
                                </Card>
                            </a>
                        ))}
                    </section>
                ) : (
                    <div className="bookmarks-empty">No matching services.</div>
                )}

                <footer className="bookmarks-footer">
                    Configuration: <code>{CONFIG_PATH}</code>
                </footer>
            </main>
        </Page>
    );
};
