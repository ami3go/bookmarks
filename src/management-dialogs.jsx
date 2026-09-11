import React from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';
import { TextArea } from '@patternfly/react-core/dist/esm/components/TextArea/index.js';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput/index.js';

import {
    ACCENT_PRESETS,
    CONFIG_PATH,
    DISPLAY_MODES,
    ICON_PRESETS,
    OPEN_MODES,
    allowedUrl,
    serviceGroup,
} from './bookmarks.js';
import { formatHistoryDate } from './bookmark-ui.js';

export function ManagementDialogs({
    editor,
    closeEditor,
    writeErrors,
    submitEditor,
    warnings,
    draft,
    updateDraft,
    formErrors,
    resolvedPreview,
    groups,
    saving,
    moveTarget,
    setMoveTarget,
    moveGroupDraft,
    setMoveGroupDraft,
    clearWriteError,
    moveBookmarkToGroup,
    editMode,
    deleteTarget,
    setDeleteTarget,
    deleteBookmark,
    settingsOpen,
    setSettingsOpen,
    settingsDraft,
    setSettingsDraft,
    settingsError,
    setSettingsError,
    submitSettings,
    importCandidate,
    setImportCandidate,
    confirmImport,
    historyOpen,
    setHistoryOpen,
    config,
    restoreHistory,
}) {
    const updateSetting = (field, value) => {
        clearWriteError('settings');
        setSettingsDraft(current => ({ ...current, [field]: value }));
    };

    return (
        <>
            <Modal isOpen={editor !== null} onClose={closeEditor} variant="medium">
                <ModalHeader title={editor?.mode === 'edit' ? 'Edit bookmark' : 'Add bookmark'} />
                <ModalBody>
                    {writeErrors.editor && <Alert isInline variant="danger" title={writeErrors.editor} />}
                    <Form id="bookmark-editor-form" onSubmit={submitEditor}>
                        {warnings.length > 0 && (
                            <Alert isInline variant="warning" title="Possible duplicate">
                                {warnings.join(' ')}
                            </Alert>
                        )}
                        <FormGroup label="Name" isRequired fieldId="bookmark-name">
                            <TextInput
                                id="bookmark-name"
                                value={draft.name}
                                onChange={(_event, value) => updateDraft('name', value)}
                                isRequired
                                validated={formErrors.name ? 'error' : 'default'}
                            />
                            {formErrors.name && <div className="bookmark-field-error">{formErrors.name}</div>}
                        </FormGroup>
                        <FormGroup label="URL" isRequired fieldId="bookmark-url">
                            <TextInput
                                id="bookmark-url"
                                value={draft.url}
                                onChange={(_event, value) => updateDraft('url', value)}
                                placeholder="http://{host}:3000"
                                isRequired
                                validated={formErrors.url ? 'error' : 'default'}
                            />
                            {formErrors.url && <div className="bookmark-field-error">{formErrors.url}</div>}
                            {!formErrors.url && (
                                <div className="bookmark-field-help">
                                    Use <code>{'{host}'}</code> for the Cockpit host name or IP address.
                                    {resolvedPreview && allowedUrl(resolvedPreview) && (
                                        <div>Resolved URL: <code>{resolvedPreview}</code></div>
                                    )}
                                </div>
                            )}
                        </FormGroup>
                        <FormGroup label="Alternate addresses" fieldId="bookmark-endpoints">
                            <TextArea
                                id="bookmark-endpoints"
                                value={draft.endpoints}
                                onChange={(_event, value) => updateDraft('endpoints', value)}
                                placeholder={'LAN | http://192.168.1.20:3000\nRemote | https://grafana.example.com'}
                                resizeOrientation="vertical"
                                validated={formErrors.endpoints ? 'error' : 'default'}
                            />
                            {formErrors.endpoints && <div className="bookmark-field-error">{formErrors.endpoints}</div>}
                            <div className="bookmark-field-help">
                                Optional. Add one address per line as <code>Label | URL</code>. The primary URL remains the default.
                            </div>
                        </FormGroup>
                        <FormGroup label="Open behavior" fieldId="bookmark-open-mode">
                            <select
                                id="bookmark-open-mode"
                                className="bookmark-select"
                                value={draft.openMode}
                                onChange={event => updateDraft('openMode', event.target.value)}
                            >
                                {OPEN_MODES.map(mode => (
                                    <option value={mode} key={mode}>
                                        {mode === 'same-tab' ? 'Same tab' : 'New tab'}
                                    </option>
                                ))}
                            </select>
                            <div className="bookmark-field-help">New tab is the default for existing bookmarks.</div>
                        </FormGroup>
                        <FormGroup label="Availability" fieldId="bookmark-status-check">
                            <label className="bookmarks-checkbox">
                                <input
                                    id="bookmark-status-check"
                                    type="checkbox"
                                    checked={draft.statusCheck !== false}
                                    onChange={event => updateDraft('statusCheck', event.target.checked)}
                                />
                                <span>Check whether this service is reachable from the Cockpit host</span>
                            </label>
                            <div className="bookmark-field-help">Checks TCP reachability of the primary and alternate addresses. No HTTP credentials are sent.</div>
                        </FormGroup>
                        <FormGroup label="Description" fieldId="bookmark-description">
                            <TextArea
                                id="bookmark-description"
                                value={draft.description}
                                onChange={(_event, value) => updateDraft('description', value)}
                                resizeOrientation="vertical"
                            />
                        </FormGroup>
                        <FormGroup label="Group" fieldId="bookmark-group">
                            <TextInput
                                id="bookmark-group"
                                value={draft.group}
                                onChange={(_event, value) => updateDraft('group', value)}
                                placeholder="Monitoring"
                                list="bookmark-group-options"
                            />
                            <datalist id="bookmark-group-options">
                                {groups.filter(group => group !== 'Ungrouped').map(group => <option value={group} key={group} />)}
                            </datalist>
                        </FormGroup>
                        <FormGroup label="Icon" fieldId="bookmark-icon">
                            <TextInput
                                id="bookmark-icon"
                                value={draft.icon}
                                onChange={(_event, value) => updateDraft('icon', value)}
                                placeholder="📊"
                            />
                            <div className="bookmark-icon-presets" aria-label="Common icons">
                                {ICON_PRESETS.map(icon => (
                                    <button
                                        type="button"
                                        className={draft.icon === icon ? 'is-selected' : ''}
                                        onClick={() => updateDraft('icon', icon)}
                                        aria-label={`Use ${icon} icon`}
                                        key={icon}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </FormGroup>
                        <FormGroup label="Card accent" fieldId="bookmark-accent">
                            <div className="bookmark-accent-presets" aria-label="Card accent presets">
                                {ACCENT_PRESETS.map(option => (
                                    <button
                                        type="button"
                                        className={`bookmark-accent-choice accent-${option.value}${draft.accent === option.value ? ' is-selected' : ''}`}
                                        onClick={() => updateDraft('accent', option.value)}
                                        aria-label={`Use ${option.label} card accent`}
                                        title={option.label}
                                        key={option.value}
                                    >
                                        <span aria-hidden="true" />
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </FormGroup>
                        <FormGroup label="Tags" fieldId="bookmark-tags">
                            <TextInput
                                id="bookmark-tags"
                                value={draft.tags}
                                onChange={(_event, value) => updateDraft('tags', value)}
                                placeholder="dashboard, monitoring"
                            />
                            <div className="bookmark-field-help">Separate tags with commas. Tags are searchable.</div>
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" type="submit" form="bookmark-editor-form" isDisabled={saving}>
                        {saving ? 'Saving…' : (editor?.mode === 'edit' ? 'Save changes' : 'Add bookmark')}
                    </Button>
                    <Button variant="link" onClick={closeEditor} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={moveTarget !== null} onClose={() => !saving && setMoveTarget(null)} variant="small">
                <ModalHeader title="Move bookmark to group" />
                <ModalBody>
                    {writeErrors.move && <Alert isInline variant="danger" title={writeErrors.move} />}
                    {moveTarget && (
                        <FormGroup label={`Destination for ${moveTarget.service.name || 'bookmark'}`} fieldId="move-bookmark-group">
                            <select
                                id="move-bookmark-group"
                                className="bookmark-select"
                                value={moveGroupDraft}
                                onChange={event => {
                                    clearWriteError('move');
                                    setMoveGroupDraft(event.target.value);
                                }}
                            >
                                {[...new Set(['Ungrouped', ...groups])].map(group => (
                                    <option value={group} key={group}>{group}</option>
                                ))}
                            </select>
                        </FormGroup>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="primary"
                        onClick={moveBookmarkToGroup}
                        isDisabled={saving || !editMode || !moveTarget || serviceGroup(moveTarget.service) === moveGroupDraft}
                    >
                        {saving ? 'Moving…' : 'Move'}
                    </Button>
                    <Button variant="link" onClick={() => setMoveTarget(null)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={deleteTarget !== null} onClose={() => !saving && setDeleteTarget(null)} variant="small">
                <ModalHeader title="Delete bookmark?" titleIconVariant="danger" />
                <ModalBody>
                    {writeErrors.delete && <Alert isInline variant="danger" title={writeErrors.delete} />}
                    {deleteTarget && (
                        <p>
                            Delete <strong>{deleteTarget.service.name || 'this bookmark'}</strong>? This removes it from {CONFIG_PATH}.
                        </p>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="danger" onClick={deleteBookmark} isDisabled={saving}>
                        {saving ? 'Deleting…' : 'Delete'}
                    </Button>
                    <Button variant="link" onClick={() => setDeleteTarget(null)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={settingsOpen} onClose={() => !saving && setSettingsOpen(false)} variant="medium">
                <ModalHeader title="Page settings" />
                <ModalBody>
                    {writeErrors.settings && <Alert isInline variant="danger" title={writeErrors.settings} />}
                    <Form id="bookmark-settings-form" onSubmit={submitSettings}>
                        <FormGroup label="Title" isRequired fieldId="settings-title">
                            <TextInput
                                id="settings-title"
                                value={settingsDraft.title}
                                onChange={(_event, value) => {
                                    updateSetting('title', value);
                                    setSettingsError('');
                                }}
                                validated={settingsError ? 'error' : 'default'}
                            />
                            {settingsError && <div className="bookmark-field-error">{settingsError}</div>}
                        </FormGroup>
                        <FormGroup label="Subtitle" fieldId="settings-subtitle">
                            <TextInput
                                id="settings-subtitle"
                                value={settingsDraft.subtitle}
                                onChange={(_event, value) => updateSetting('subtitle', value)}
                            />
                        </FormGroup>
                        <FormGroup label="Eyebrow" fieldId="settings-eyebrow">
                            <TextInput
                                id="settings-eyebrow"
                                value={settingsDraft.eyebrow}
                                onChange={(_event, value) => updateSetting('eyebrow', value)}
                                isDisabled={!settingsDraft.showEyebrow}
                            />
                        </FormGroup>
                        <label className="bookmarks-checkbox">
                            <input
                                type="checkbox"
                                checked={settingsDraft.showEyebrow}
                                onChange={event => updateSetting('showEyebrow', event.target.checked)}
                            />
                            <span>Show eyebrow above the page title</span>
                        </label>
                        <FormGroup label="Visible page elements" fieldId="settings-show-header">
                            <div className="bookmarks-visibility-options">
                                <label className="bookmarks-checkbox">
                                    <input
                                        id="settings-show-header"
                                        type="checkbox"
                                        checked={settingsDraft.showHeader}
                                        onChange={event => updateSetting('showHeader', event.target.checked)}
                                    />
                                    <span>Show header</span>
                                </label>
                                <label className="bookmarks-checkbox">
                                    <input
                                        id="settings-show-title"
                                        type="checkbox"
                                        checked={settingsDraft.showTitle}
                                        onChange={event => updateSetting('showTitle', event.target.checked)}
                                    />
                                    <span>Show title</span>
                                </label>
                                <label className="bookmarks-checkbox">
                                    <input
                                        id="settings-show-search"
                                        type="checkbox"
                                        checked={settingsDraft.showSearch}
                                        onChange={event => updateSetting('showSearch', event.target.checked)}
                                    />
                                    <span>Show search bar</span>
                                </label>
                            </div>
                            <div className="bookmark-field-help">
                                A hidden header is temporarily shown while Edit mode is active so administrators can always restore it.
                            </div>
                        </FormGroup>
                        <FormGroup label="Display density" fieldId="settings-display-mode">
                            <select
                                id="settings-display-mode"
                                className="bookmark-select"
                                value={settingsDraft.displayMode}
                                onChange={event => updateSetting('displayMode', event.target.value)}
                            >
                                {DISPLAY_MODES.map(mode => (
                                    <option value={mode} key={mode}>
                                        {mode === 'compact' ? 'Compact cards' : 'Standard cards'}
                                    </option>
                                ))}
                            </select>
                            <div className="bookmark-field-help">
                                Compact cards fit more services on screen while keeping groups and management controls.
                            </div>
                        </FormGroup>
                    </Form>
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" type="submit" form="bookmark-settings-form" isDisabled={saving}>
                        {saving ? 'Saving…' : 'Save settings'}
                    </Button>
                    <Button variant="link" onClick={() => setSettingsOpen(false)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={importCandidate !== null} onClose={() => !saving && setImportCandidate(null)} variant="small">
                <ModalHeader title="Import configuration?" />
                <ModalBody>
                    {writeErrors.import && <Alert isInline variant="danger" title={writeErrors.import} />}
                    {importCandidate && (
                        <>
                            <p>
                                Replace the current configuration with <strong>{importCandidate.services.length}</strong> imported bookmarks?
                            </p>
                            <p>The current configuration will be kept in History before the import is applied.</p>
                        </>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="primary" onClick={confirmImport} isDisabled={saving || !editMode}>
                        {saving ? 'Importing…' : 'Import'}
                    </Button>
                    <Button variant="link" onClick={() => setImportCandidate(null)} isDisabled={saving}>Cancel</Button>
                </ModalFooter>
            </Modal>

            <Modal isOpen={historyOpen} onClose={() => !saving && setHistoryOpen(false)} variant="medium">
                <ModalHeader title="Configuration history" />
                <ModalBody>
                    {writeErrors.history && <Alert isInline variant="danger" title={writeErrors.history} />}
                    {config.history.length === 0 ? (
                        <p>No history yet. A snapshot is saved automatically before each configuration change.</p>
                    ) : (
                        <div className="bookmarks-history-list">
                            {[...config.history].reverse().map(entry => (
                                <div className="bookmarks-history-item" key={entry.id || `${entry.savedAt}-${entry.action}`}>
                                    <div>
                                        <strong>{entry.action || 'Configuration changed'}</strong>
                                        <div>{formatHistoryDate(entry.savedAt)}</div>
                                        <div>{entry.config?.services?.length ?? 0} bookmarks</div>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() => restoreHistory(entry)}
                                        isDisabled={saving || !editMode}
                                    >
                                        Restore
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => setHistoryOpen(false)} isDisabled={saving}>Close</Button>
                </ModalFooter>
            </Modal>
        </>
    );
}
