#!/usr/bin/env node
/**
 * build-cli.mjs — Bundle gad CLI into a single distributable file.
 *
 * Uses esbuild to bundle bin/gad.cjs + all lib/*.cjs + bin/gad-config.cjs
 * into dist/gad.cjs — a single file that only needs Node.js to run.
 *
 * Usage:
 *   node scripts/build-cli.mjs
 *
 * Output:
 *   dist/gad.cjs
 */

import { build } from 'esbuild';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENTRY = join(ROOT, 'bin', 'gad.cjs');
const OUT_DIR = join(ROOT, 'dist');

// Ensure dist/ exists
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

console.log(`Building GAD CLI v${pkg.version}...`);
console.log(`  Entry: bin/gad.cjs`);
console.log(`  Output: dist/gad.cjs`);

try {
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: join(OUT_DIR, 'gad.cjs'),
    // esbuild preserves the source shebang in CJS mode — no banner needed
    // Externalize only Node built-ins (everything else gets bundled)
    external: [
      'fs', 'path', 'os', 'child_process', 'crypto', 'http', 'https',
      'net', 'tls', 'url', 'util', 'events', 'stream', 'zlib',
      'readline', 'module', 'vm', 'worker_threads', 'perf_hooks',
      'assert', 'buffer', 'string_decoder', 'querystring', 'dgram',
      'dns', 'tty', 'cluster',
      // Node prefix imports
      'node:fs', 'node:path', 'node:os', 'node:child_process',
      'node:crypto', 'node:http', 'node:https', 'node:net',
      'node:tls', 'node:url', 'node:util', 'node:events',
      'node:stream', 'node:zlib', 'node:readline', 'node:module',
      'node:vm', 'node:worker_threads', 'node:perf_hooks',
      'node:assert', 'node:buffer', 'node:string_decoder',
      'node:querystring', 'node:dgram', 'node:dns', 'node:tty',
      'node:cluster', 'node:fs/promises', 'node:timers/promises',
      'fs/promises',
      '@huggingface/transformers',
      'onnxruntime-node',
      'onnxruntime-common',
      'onnxruntime-web',
      'sharp',
    ],
    // Define __dirname and __filename to work correctly in bundled output
    define: {},
    // Minify but keep readable for debugging
    minify: false,
    // Source map for debugging
    sourcemap: false,
    // Log level
    logLevel: 'info',
  });

  console.log(`\nBuild complete.`);
  console.log(`  Output: dist/gad.cjs`);
  console.log(`\nTest with: node dist/gad.cjs --help`);
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
