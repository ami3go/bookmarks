import React from 'react';
import { createRoot } from 'react-dom/client';

import '@patternfly/patternfly/patternfly.css';
import './cockpit-dark-theme.js';
import './app.css';
import './header-actions.css';
import './bookmark-sections.css';
import './bookmark-hover.css';
import './page-visibility.css';
import './service-discovery.css';
import './gotty-launcher-manager.css';
import './update-notification.css';
import { Application } from './app.jsx';
import { AppProviders } from './app-providers.jsx';
import { UpdateNotification } from './update-notification.jsx';

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    createRoot(root).render(
        <AppProviders>
            <UpdateNotification />
            <Application />
        </AppProviders>
    );
});
