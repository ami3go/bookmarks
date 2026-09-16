import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, '.ui-test-tmp');
const outputFile = path.join(outputDir, 'components.test.mjs');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

try {
    await build({
        entryPoints: [path.join(root, 'tests-ui', 'components.test.jsx')],
        outfile: outputFile,
        bundle: true,
        packages: 'external',
        platform: 'node',
        format: 'esm',
        target: 'node18',
        jsx: 'automatic',
        logLevel: 'warning',
    });

    const result = spawnSync(process.execPath, ['--test', outputFile], {
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
