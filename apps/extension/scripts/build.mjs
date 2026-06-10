/**
 * Extension build script
 *
 *  1. esbuild → background.js  (ESM bundle — MV3 service worker)
 *  2. esbuild → content.js     (IIFE bundle — injected into YouTube)
 *  3. Vite    → popup.html + popup.js + popup.css  (React + Tailwind)
 *  4. Copy    manifest.json to dist/
 *  5. Generate placeholder PNG icons (16/32/48/128 px)
 */

import * as esbuild from 'esbuild';
import { build as viteBuild } from 'vite';
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root    = resolve(__dirname, '..');
const pkgs    = resolve(root, '../../packages');
const distDir = resolve(root, 'dist');

const watch = process.argv.includes('--watch');

// ─── Shared alias plugin (workspace packages → TS source) ────────────────────

const workspaceAlias = {
  name: 'workspace-alias',
  setup(build) {
    const map = {
      '@binge-room/shared-types': resolve(pkgs, 'shared-types/src/index.ts'),
      '@binge-room/shared-utils': resolve(pkgs, 'shared-utils/src/index.ts'),
      '@binge-room/event-schema': resolve(pkgs, 'event-schema/src/index.ts'),
      '@binge-room/platform-sdk': resolve(pkgs, 'platform-sdk/src/index.ts'),
    };
    build.onResolve({ filter: /^@binge-room\// }, (args) => {
      const p = map[args.path];
      return p ? { path: p } : null;
    });
  },
};

// ─── 1. Background service worker ────────────────────────────────────────────

async function buildBackground() {
  console.log('Building background.js…');
  await esbuild.build({
    entryPoints: [resolve(root, 'src/background/service-worker.ts')],
    bundle:   true,
    outfile:  resolve(distDir, 'background.js'),
    format:   'esm',
    target:   ['chrome120'],
    platform: 'browser',
    define:   { 'process.env.NODE_ENV': '"production"' },
    plugins:  [workspaceAlias],
    minify:   false,
    sourcemap: watch,
  });
  console.log('  ✓ background.js');
}

// ─── 2. Content script ───────────────────────────────────────────────────────

async function buildContent() {
  console.log('Building content.js…');
  await esbuild.build({
    entryPoints: [resolve(root, 'src/content/index.ts')],
    bundle:   true,
    outfile:  resolve(distDir, 'content.js'),
    format:   'iife',
    target:   ['chrome120'],
    platform: 'browser',
    define:   { 'process.env.NODE_ENV': '"production"' },
    plugins:  [workspaceAlias],
    minify:   false,
    sourcemap: watch,
  });
  console.log('  ✓ content.js');
}

// ─── 3. Popup (Vite + React + Tailwind) ──────────────────────────────────────

async function buildPopup() {
  console.log('Building popup (Vite)…');
  // Dynamically import vite config so aliases resolve correctly
  await viteBuild({
    configFile: resolve(root, 'vite.config.ts'),
    logLevel:   'warn',
  });
  console.log('  ✓ popup.html / popup.js / popup.css');
}

// ─── 4. Copy manifest ────────────────────────────────────────────────────────

function copyManifest() {
  cpSync(resolve(root, 'public/manifest.json'), resolve(distDir, 'manifest.json'));
  console.log('  ✓ manifest.json');
}

// ─── 5. Placeholder icons (minimal valid PNG – 1×1 purple pixel scaled) ──────
//
// A real production build should replace these with proper PNG artwork.
// These are valid PNG files Chrome will accept without errors.

const ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function generateIcons() {
  const iconsDir = resolve(distDir, 'icons');
  mkdirSync(iconsDir, { recursive: true });
  const buf = Buffer.from(ICON_PNG_BASE64, 'base64');
  for (const size of [16, 32, 48, 128]) {
    const out = resolve(iconsDir, `icon${size}.png`);
    if (!existsSync(out)) {
      writeFileSync(out, buf);
    }
  }
  console.log('  ✓ icons/');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔨  Binge-Room extension build\n');
  mkdirSync(distDir, { recursive: true });

  // Steps 1-4 can run in parallel
  await Promise.all([
    buildBackground(),
    buildContent(),
  ]);

  copyManifest();
  generateIcons();

  // Popup build last (emptyOutDir: false so it doesn't wipe the files above)
  await buildPopup();

  console.log('\n✅  dist/ is ready — load it in Chrome at chrome://extensions\n');
}

main().catch((err) => {
  console.error('\n❌  Build failed:', err.message ?? err);
  process.exit(1);
});
