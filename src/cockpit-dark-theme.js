const SHELL_STYLE_KEY = 'shell:style';
const DARK_THEME_CLASS = 'pf-v6-theme-dark';
const colorScheme = window.matchMedia?.('(prefers-color-scheme: dark)');

function readShellStyle() {
    try {
        return window.localStorage.getItem(SHELL_STYLE_KEY) || 'auto';
    } catch (_) {
        return 'auto';
    }
}

function prefersDark(style) {
    if (style === 'dark')
        return true;
    if (style === 'light')
        return false;
    return Boolean(colorScheme?.matches);
}

function applyTheme(style = readShellStyle()) {
    document.documentElement.classList.toggle(DARK_THEME_CLASS, prefersDark(style));
}

window.addEventListener('cockpit-style', event => {
    const style = event instanceof CustomEvent ? event.detail?.style : undefined;
    applyTheme(style || readShellStyle());
});

window.addEventListener('storage', event => {
    if (event.key === SHELL_STYLE_KEY)
        applyTheme();
});

colorScheme?.addEventListener?.('change', () => {
    if (readShellStyle() === 'auto')
        applyTheme('auto');
});

applyTheme();
