#!/usr/bin/env node

import fs from 'node:fs/promises';
import process from 'node:process';
import { context } from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.env.NODE_ENV === 'production';

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cockpit Bookmarks</title>
  <link href="../../static/branding.css" rel="stylesheet">
  <link href="index.css" rel="stylesheet">
  <script src="../base1/cockpit.js"></script>
  <script src="index.js" defer></script>
</head>
<body>
  <div id="app"></div>
</body>
</html>
`;

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

async function writeStaticFiles() {
    await Promise.all([
        fs.writeFile('dist/index.html', html),
        fs.copyFile('src/manifest.json', 'dist/manifest.json'),
    ]);
}

await buildContext.rebuild();
await writeStaticFiles();

if (watch) {
    await buildContext.watch();
    console.log('Watching src/ for changes. Press Ctrl-C to stop.');
    await new Promise(() => {});
} else {
    await buildContext.dispose();
}
