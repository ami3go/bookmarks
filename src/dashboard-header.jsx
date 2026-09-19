import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { SearchInput } from '@patternfly/react-core/dist/esm/components/SearchInput/index.js';

import { SelectControl } from './form-controls.jsx';

function PencilIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a.996.996 0 0 0 0-1.41l-2.5-2.5a.996.996 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-1.8Z" />
        </svg>
    );
}

export function DashboardHeader({
    config,
    editMode,
    previewSettings = false,
    canEdit,
    saving,
    query,
    setQuery,
    groupFilter,
    setGroupFilter,
    groups,
    onAddBookmark,
    onAddApp,
    onToggleEditMode,
}) {
    const headerTextVisible = config.showHeader || (editMode && !previewSettings);
    const titleVisible = config.showTitle;
    const headingVisible = headerTextVisible || titleVisible;
    const groupOptions = [
        { value: 'all', label: 'All groups' },
        ...groups.map(group => ({ value: group, label: group })),
    ];

    return (
        <header className={`bookmarks-header${headingVisible ? '' : ' bookmarks-header-no-heading'}`}>
            {headingVisible && (
                <div className="bookmarks-heading">
                    {headerTextVisible && config.showEyebrow && config.eyebrow && (
                        <p className="bookmarks-eyebrow">{config.eyebrow}</p>
                    )}
                    {titleVisible && <h1>{config.title}</h1>}
                    {headerTextVisible && config.subtitle && <p className="bookmarks-subtitle">{config.subtitle}</p>}
                </div>
            )}
            <div className="bookmarks-header-actions">
                {config.showSearch && (
                    <div className="bookmarks-search">
                        <SearchInput
                            aria-label="Search bookmarks"
                            placeholder="Search bookmarks…"
                            value={query}
                            onChange={(_event, value) => setQuery(value)}
                            onClear={() => setQuery('')}
                        />
                    </div>
                )}
                <div className="bookmarks-group-filter">
                    <SelectControl value={groupFilter} ariaLabel="Filter by group" onChange={setGroupFilter} options={groupOptions} />
                </div>
                <Button variant="primary" onClick={onAddBookmark} isDisabled={canEdit !== true}>Add bookmark</Button>
                <Button variant="secondary" onClick={onAddApp} isDisabled={canEdit !== true}>Add app</Button>
                <Button
                    variant={editMode ? 'secondary' : 'plain'}
                    className="bookmark-edit-mode-toggle"
                    onClick={onToggleEditMode}
                    isDisabled={canEdit !== true || saving}
                    aria-label={editMode ? 'Disable edit mode' : 'Enable edit mode'}
                    aria-pressed={editMode}
                    title={editMode ? 'Disable edit mode' : 'Enable edit mode'}
                >
                    <PencilIcon />
                </Button>
            </div>
        </header>
    );
}
