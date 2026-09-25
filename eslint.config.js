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
            globals: browserGlobals,
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'no-undef': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
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
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
        },
    },
];
