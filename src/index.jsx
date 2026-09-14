import React from 'react';
import { createRoot } from 'react-dom/client';

import '@patternfly/patternfly/patternfly.css';
import './cockpit-dark-theme.js';
import './app.css';
import './bookmark-sections.css';
import './bookmark-hover.css';
import './management-dialogs.css';
import './page-visibility.css';
import './native-controls.css';
import './floating-action-menu.css';
import './floating-action-menu.js';
import './service-discovery.css';
import './gotty-launcher-manager.css';
import './application-launcher-manager.css';
import './update-notification.css';
import { Application } from './app.jsx';
import { ApplicationCardEditor } from './application-card-editor.jsx';
import { ApplicationLauncherManager } from './application-launcher-manager.jsx';
import { ApplicationsCategoryMigrator } from './applications-category-migrator.jsx';
import { installApplicationLauncherOpenInterceptor } from './application-launcher.js';
import { TerminalCardEditor } from './terminal-card-editor.jsx';
import { TerminalLauncherManager } from './terminal-launcher-manager.jsx';
import { TerminalProviderCompatibilityNotifier } from './terminal-provider-compatibility-notifier.jsx';
import { installTerminalLauncherOpenInterceptor } from './terminal-launcher.js';
import { UpdateNotification } from './update-notification.jsx';

installTerminalLauncherOpenInterceptor();
installApplicationLauncherOpenInterceptor();

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    createRoot(root).render(
        <>
            <UpdateNotification />
            <TerminalProviderCompatibilityNotifier />
            <ApplicationsCategoryMigrator />
            <Application />
            <TerminalCardEditor />
            <ApplicationCardEditor />
            <TerminalLauncherManager />
            <ApplicationLauncherManager />
        </>
    );
});
