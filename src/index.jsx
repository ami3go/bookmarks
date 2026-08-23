import React from 'react';
import { createRoot } from 'react-dom/client';

import '@patternfly/patternfly/patternfly.css';
import './cockpit-dark-theme.js';
import './app.css';
import './bookmark-sections.css';
import './management-dialogs.css';
import './native-controls.css';
import './floating-action-menu.css';
import './floating-action-menu.js';
import './service-discovery.css';
import { Application } from './app.jsx';

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    createRoot(root).render(<Application />);
});
