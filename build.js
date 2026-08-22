#!/usr/bin/env node

import fs from 'node:fs/promises';
import process from 'node:process';
import { context } from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.env.NODE_ENV === 'production';

await fs.rm('dist', { recursive: true, force: true });
await fs.mkdir('dist', { recursive: true });

const buildContext = await context({
    entryPoints: ['src/index.jsx'],
    bundle: true,
    outdir: 'dist',
    target: ['es2020'],
    minify: production,
    sourcemap: production ? false : 'linked',
    legalComments: 'external',
});

async function copyStaticFiles() {
    await Promise.all([
        fs.copyFile('src/index.html', 'dist/index.html'),
        fs.copyFile('src/manifest.json', 'dist/manifest.json'),
    ]);
}

await buildContext.rebuild();
await copyStaticFiles();

if (watch) {
    await buildContext.watch();
    console.log('Watching src/ for changes. Press Ctrl-C to stop.');
    await new Promise(() => {});
} else {
    await buildContext.dispose();
}
