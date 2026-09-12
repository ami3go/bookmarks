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
import './update-notification.css';
import { Application } from './app.jsx';
import { GoTTYCardEditor } from './gotty-card-editor.jsx';
import { GoTTYLauncherManager } from './gotty-launcher-manager.jsx';
import { installGoTTYLauncherOpenInterceptor } from './gotty-launcher.js';
import { UpdateNotification } from './update-notification.jsx';

installGoTTYLauncherOpenInterceptor();

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    createRoot(root).render(
        <>
            <UpdateNotification />
            <Application />
            <GoTTYCardEditor />
            <GoTTYLauncherManager />
        </>
    );
});
