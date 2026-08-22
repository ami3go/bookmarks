// Adapted from Cockpit's pkg/lib/cockpit-dark-theme.ts (LGPL-2.1-or-later).

function setDarkMode(styleOverride) {
    const style = styleOverride || localStorage.getItem('shell:style') || 'auto';
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const dark = style === 'dark' || (style === 'auto' && prefersDark);
    document.documentElement.classList.toggle('pf-v6-theme-dark', Boolean(dark));
}

window.addEventListener('storage', event => {
    if (event.key === 'shell:style')
        setDarkMode();
});

window.addEventListener('cockpit-style', event => {
    if (event instanceof CustomEvent)
        setDarkMode(event.detail?.style);
});

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => setDarkMode());
setDarkMode();
