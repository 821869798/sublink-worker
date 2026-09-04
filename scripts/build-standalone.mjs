#!/usr/bin/env node
/**
 * Build a single-file distributable exe (Node SEA) for Windows x64.
 *
 * Flow:
 *   1. esbuild bundle with public/ favicons embedded (no external files needed)
 *   2. generate SEA blob via node --experimental-sea-config
 *   3. copy node.exe and inject the blob with postject
 *
 * Usage: node scripts/build-standalone.mjs
 * Output: dist/standalone/sublink.exe
 */
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist', 'standalone');
const SEA_BLOB_KEY = 'NODE_SEA_BLOB';
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

async function findSignTool() {
    const windowsKits = path.join(process.env['ProgramFiles(x86)'] || '', 'Windows Kits', '10', 'bin');
    try {
        const versions = (await fs.readdir(windowsKits, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
            .reverse();
        for (const version of versions) {
            const candidate = path.join(windowsKits, version, 'x64', 'signtool.exe');
            try {
                await fs.access(candidate);
                return candidate;
            } catch {
                // Keep looking for another installed Windows SDK.
            }
        }
    } catch {
        // Windows SDK is optional; postject can still produce a runnable exe.
    }
    return null;
}

// public/ contains only favicons; embed them so the exe needs zero external files.
const EMBED_ASSETS = ['public/favicon.ico', 'public/favicon.png'];

const assetContents = await Promise.all(EMBED_ASSETS.map(async (file) => ({
    name: path.basename(file),
    base64: (await fs.readFile(path.join(rootDir, file))).toString('base64')
})));

const embedAssetsPlugin = {
    name: 'embed-assets',
    setup(build) {
        build.onResolve({ filter: /^embedded:assets$/ }, (args) => ({
            path: args.path,
            namespace: 'embedded-assets'
        }));
        build.onLoad({ filter: /.*/, namespace: 'embedded-assets' }, () => ({
            contents: `export const embeddedAssets = ${JSON.stringify(assetContents)};`,
            loader: 'js'
        }));
    }
};

// The runtime reads assets via createFileAssetFetcher('public'). In the
// single-file exe there is no public/ directory, so rewrite that import to a
// memory-backed fetcher over the embedded assets.
const rewriteAssetFetcherPlugin = {
    name: 'rewrite-asset-fetcher',
    setup(build) {
        build.onResolve({ filter: /adapters\/assets\/fileAssetFetcher\.js$/ }, () => ({
            path: path.join(__dirname, 'standaloneAssetFetcherStub.mjs'),
            namespace: 'file'
        }));
    }
};

async function main() {
    if (process.platform !== 'win32') {
        throw new Error('build:standalone currently targets Windows x64 and must run on Windows');
    }

    await fs.mkdir(outDir, { recursive: true });
    await Promise.all([
        'sublink-server.cjs',
        'sea-config.json',
        'sea-prep.blob',
        process.platform === 'win32' ? 'sublink.exe' : 'sublink'
    ].map((name) => fs.rm(path.join(outDir, name), { force: true })));

    const bundlePath = path.join(outDir, 'sublink-server.cjs');
    await build({
        entryPoints: [path.join(rootDir, 'src', 'platforms', 'node-server.js')],
        bundle: true,
        platform: 'node',
        target: ['node18'],
        format: 'cjs',
        minify: true,
        define: {
            __STANDALONE__: 'true'
        },
        outfile: bundlePath,
        plugins: [embedAssetsPlugin, rewriteAssetFetcherPlugin],
        logLevel: 'info'
    });

    const seaConfigPath = path.join(outDir, 'sea-config.json');
    const blobPath = path.join(outDir, 'sea-prep.blob');
    const executableName = process.platform === 'win32' ? 'sublink.exe' : 'sublink';
    const exePath = path.join(outDir, executableName);

    await fs.writeFile(seaConfigPath, JSON.stringify({
        main: path.basename(bundlePath),
        output: path.basename(blobPath),
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: true
    }));

    execFileSync(process.execPath, ['--experimental-sea-config', path.basename(seaConfigPath)], {
        cwd: outDir,
        stdio: 'inherit'
    });

    // Copy the current node binary and remove its original Authenticode
    // signature before mutation; distributors can sign the final exe later.
    await fs.copyFile(process.execPath, exePath);
    const signTool = await findSignTool();
    if (signTool) {
        execFileSync(signTool, ['remove', '/s', exePath], { stdio: 'inherit' });
    } else {
        console.warn('Windows SDK signtool not found; the copied Node signature will become invalid after injection');
    }

    const postjectCli = path.join(rootDir, 'node_modules', 'postject', 'dist', 'cli.js');
    execFileSync(process.execPath, [postjectCli, exePath, SEA_BLOB_KEY, blobPath, '--sentinel-fuse', SEA_FUSE], { stdio: 'inherit' });

    await fs.rm(blobPath, { force: true });
    console.log(`\n✓ Single executable: ${exePath}`);
}

main().catch((error) => {
    console.error('Standalone build failed');
    console.error(error);
    process.exitCode = 1;
});
