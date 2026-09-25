import reactHooks from 'eslint-plugin-react-hooks';

const browserGlobals = {
    Blob: 'readonly',
    CustomEvent: 'readonly',
    Element: 'readonly',
    Event: 'readonly',
    HTMLElement: 'readonly',
    HTMLInputElement: 'readonly',
    HTMLSelectElement: 'readonly',
    KeyboardEvent: 'readonly',
    MouseEvent: 'readonly',
    MutationObserver: 'readonly',
    Node: 'readonly',
    ResizeObserver: 'readonly',
    SVGElement: 'readonly',
    TextEncoder: 'readonly',
    URL: 'readonly',
    cancelAnimationFrame: 'readonly',
    clearInterval: 'readonly',
    clearTimeout: 'readonly',
    console: 'readonly',
    document: 'readonly',
    fetch: 'readonly',
    globalThis: 'readonly',
    navigator: 'readonly',
    queueMicrotask: 'readonly',
    requestAnimationFrame: 'readonly',
    setInterval: 'readonly',
    setTimeout: 'readonly',
    window: 'readonly',
};

export default [
    {
        ignores: ['dist/**', 'release/**', '.ui-test-tmp/**', 'node_modules/**'],
    },
    {
        files: ['src/**/*.{js,jsx}', 'tests-ui/**/*.{js,jsx,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: {
                ...browserGlobals,
                process: 'readonly',
            },
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
        },
    },
    {
        files: ['tests/**/*.mjs', 'build.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...browserGlobals,
                Buffer: 'readonly',
                process: 'readonly',
            },
        },
    },
];
