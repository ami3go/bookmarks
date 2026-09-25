import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, '.ui-test-tmp');
const testEntries = [
    'components.test.jsx',
    'review-regressions.test.jsx',
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

try {
    const outputFiles = [];
    for (const entry of testEntries) {
        const source = path.join(root, 'tests-ui', entry);
        const output = path.join(outputDir, entry.replace(/\.jsx$/, '.mjs'));
        await build({
            entryPoints: [source],
            outfile: output,
            bundle: true,
            external: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                'jsdom',
                '@testing-library/react',
                '@testing-library/dom',
            ],
            platform: 'node',
            format: 'esm',
            target: 'node18',
            jsx: 'automatic',
            logLevel: 'warning',
        });
        outputFiles.push(output);
    }

    const result = spawnSync(process.execPath, ['--test', ...outputFiles], {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
    });
    if (result.error)
        throw result.error;
    process.exitCode = result.status ?? 1;
} finally {
    await rm(outputDir, { recursive: true, force: true });
}
