import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

import {
    CONFIG_PATH,
    CONFIG_SYNTAX,
    DEFAULT_CONFIG,
    MAX_CONFIG_SIZE,
    normalizeConfig,
    storedBookmark,
    withHistory,
} from './bookmarks.js';
import {
    buildDiscoveryCandidates,
    existingLocalBookmarkPorts,
    parseListeningSockets,
} from './discovery.js';

const DISCOVERY_ROOT_ID = 'cockpit-bookmarks-service-discovery';

function currentConfiguration(content) {
    return content === null
        ? { ...DEFAULT_CONFIG, services: [], history: [] }
        : normalizeConfig(content);
}

function candidateStatus(candidate) {
    if (candidate.alreadyBookmarked)
        return 'Already bookmarked';
    if (!candidate.supported)
        return candidate.reason || 'Not a web bookmark';
    if (candidate.localOnly)
        return 'Loopback only';
    if (!candidate.likelyWeb)
        return 'Unknown protocol';
    return 'Recommended';
}

function ServiceDiscoveryLauncher() {
    const [editModeVisible, setEditModeVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [candidates, setCandidates] = useState([]);

    const hostname = window.location.hostname;
    const selectedCount = useMemo(
        () => candidates.filter(candidate => candidate.selected && candidate.supported && !candidate.alreadyBookmarked).length,
        [candidates]
    );

    useEffect(() => {
        const update = () => setEditModeVisible(Boolean(document.querySelector('.bookmarks-management-bar')));
        const observer = new MutationObserver(update);
        observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
        update();
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!editModeVisible && open && !saving)
            setOpen(false);
    }, [editModeVisible, open, saving]);

    const discover = async () => {
        setOpen(true);
        setLoading(true);
        setError('');
        setCandidates([]);

        const file = window.cockpit.file(CONFIG_PATH, {
            syntax: CONFIG_SYNTAX,
            max_read_size: MAX_CONFIG_SIZE,
        });

        try {
            const [content, output] = await Promise.all([
                file.read(),
                window.cockpit.spawn(['ss', '-H', '-ltnp'], {
                    superuser: 'try',
                    err: 'message',
                }),
            ]);
            const config = currentConfiguration(content);
            const listeners = parseListeningSockets(output);
            const discovered = buildDiscoveryCandidates(listeners, config.services, hostname);
            setCandidates(discovered);
            if (listeners.length === 0)
                setError('No listening TCP services were detected.');
        } catch (discoveryError) {
            const message = window.cockpit.message(discoveryError);
            setError(`Could not inspect listening TCP ports. Service discovery requires the ss command from iproute2. ${message}`);
        } finally {
            file.close();
            setLoading(false);
        }
    };

    const toggleCandidate = port => {
        setCandidates(current => current.map(candidate => {
            if (candidate.port !== port || !candidate.supported || candidate.alreadyBookmarked)
                return candidate;
            return { ...candidate, selected: !candidate.selected };
        }));
    };

    const selectRecommended = () => {
        setCandidates(current => current.map(candidate => ({
            ...candidate,
            selected: candidate.supported && candidate.likelyWeb && !candidate.localOnly &&
                !candidate.alreadyBookmarked && candidate.port !== 9090,
        })));
    };

    const clearSelection = () => {
        setCandidates(current => current.map(candidate => ({ ...candidate, selected: false })));
    };

    const addSelected = async () => {
        const selected = candidates.filter(candidate => candidate.selected && candidate.supported && !candidate.alreadyBookmarked);
        if (selected.length === 0)
            return;

        setSaving(true);
        setError('');
        const file = window.cockpit.file(CONFIG_PATH, {
            syntax: CONFIG_SYNTAX,
            max_read_size: MAX_CONFIG_SIZE,
            superuser: 'require',
        });
        let addedCount = 0;

        try {
            await file.modify(oldContent => {
                const current = currentConfiguration(oldContent);
                const existingPorts = existingLocalBookmarkPorts(current.services, hostname);
                const additions = selected
                    .filter(candidate => !existingPorts.has(candidate.port))
                    .map(candidate => storedBookmark(candidate.bookmark));
                addedCount = additions.length;

                if (additions.length === 0)
                    return current;

                return withHistory(current, {
                    ...current,
                    services: [...current.services, ...additions],
                }, `Discovered ${additions.length} service${additions.length === 1 ? '' : 's'}`);
            });

            if (addedCount === 0) {
                setError('Those ports are already bookmarked. Run discovery again to refresh the list.');
                return;
            }

            setOpen(false);
            setCandidates([]);
        } catch (writeError) {
            setError(`Could not add discovered services: ${window.cockpit.message(writeError)}`);
        } finally {
            file.close();
            setSaving(false);
        }
    };

    if (!editModeVisible)
        return null;

    return (
        <>
            <Button
                className="bookmarks-discovery-launcher"
                variant="secondary"
                onClick={discover}
                isDisabled={loading || saving}
            >
                {loading ? 'Scanning ports…' : 'Discover services'}
            </Button>

            <Modal isOpen={open} onClose={() => !saving && setOpen(false)} variant="medium">
                <ModalHeader title="Discover services on this host" />
                <ModalBody>
                    <p className="bookmarks-discovery-intro">
                        This checks listening TCP sockets on the Cockpit host. It does not scan your LAN. HTTP/HTTPS is inferred,
                        so review the generated URL before adding unfamiliar services.
                    </p>

                    {error && <Alert isInline variant="warning" title={error} />}

                    {loading ? (
                        <div className="bookmarks-discovery-empty">Inspecting listening ports…</div>
                    ) : candidates.length === 0 && !error ? (
                        <div className="bookmarks-discovery-empty">No service candidates found.</div>
                    ) : candidates.length > 0 && (
                        <>
                            <div className="bookmarks-discovery-toolbar">
                                <span>{candidates.length} listening port{candidates.length === 1 ? '' : 's'} detected</span>
                                <div>
                                    <Button variant="link" onClick={selectRecommended} isDisabled={saving}>Select recommended</Button>
                                    <Button variant="link" onClick={clearSelection} isDisabled={saving}>Clear</Button>
                                </div>
                            </div>
                            <div className="bookmarks-discovery-list">
                                {candidates.map(candidate => {
                                    const disabled = !candidate.supported || candidate.alreadyBookmarked;
                                    return (
                                        <label
                                            className={`bookmarks-discovery-item${disabled ? ' is-disabled' : ''}`}
                                            key={candidate.port}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={candidate.selected}
                                                disabled={disabled || saving}
                                                onChange={() => toggleCandidate(candidate.port)}
                                            />
                                            <div className="bookmarks-discovery-details">
                                                <strong>{candidate.name}</strong>
                                                <code>{candidate.url}</code>
                                                <span>
                                                    TCP {candidate.port}
                                                    {candidate.process ? ` · ${candidate.process}` : ''}
                                                    {candidate.addresses.length ? ` · ${candidate.addresses.join(', ')}` : ''}
                                                </span>
                                            </div>
                                            <span className="bookmarks-discovery-status">{candidateStatus(candidate)}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <Alert isInline variant="info" title="Discovery limitations">
                                Loopback-only listeners may not be reachable from a remote browser. Unknown protocols are not selected automatically,
                                and UDP-only services are not detected.
                            </Alert>
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="primary"
                        onClick={addSelected}
                        isDisabled={saving || loading || selectedCount === 0}
                    >
                        {saving ? 'Adding…' : `Add selected (${selectedCount})`}
                    </Button>
                    <Button variant="link" onClick={() => setOpen(false)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>
        </>
    );
}

export function installServiceDiscovery() {
    let host = document.getElementById(DISCOVERY_ROOT_ID);
    if (host)
        return;

    host = document.createElement('div');
    host.id = DISCOVERY_ROOT_ID;
    document.body.appendChild(host);
    createRoot(host).render(<ServiceDiscoveryLauncher />);
}
