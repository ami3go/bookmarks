import React from 'react';
import { createRoot } from 'react-dom/client';

import '@patternfly/patternfly/patternfly.css';
import './cockpit-dark-theme.js';
import './app.css';
import './header-actions.css';
import './bookmark-sections.css';
import './bookmark-hover.css';
import './management-dialogs.css';
import './page-visibility.css';
import './native-controls.css';
import './floating-action-menu.css';
import './floating-action-menu.js';
import './service-discovery.css';
import './gotty-launcher-manager.css';
import './update-notification.css';
import { Application } from './app.jsx';
import { AppProviders } from './app-providers.jsx';
import { ApplicationsCategoryMigrator } from './applications-category-migrator.jsx';
import { TerminalLauncherManager } from './terminal-launcher-manager.jsx';
import { TerminalProviderCompatibilityNotifier } from './terminal-provider-compatibility-notifier.jsx';
import { UpdateNotification } from './update-notification.jsx';

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    createRoot(root).render(
        <AppProviders>
            <UpdateNotification />
            <TerminalProviderCompatibilityNotifier />
            <ApplicationsCategoryMigrator />
            <Application />
            <TerminalLauncherManager />
        </AppProviders>
    );
});
