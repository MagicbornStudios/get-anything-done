'use strict';

/**
 * site-compile.cjs — `gad site compile` implementation.
 *
 * Phase 10: compile a GAD project's planning data into a deployable static
 * site using GAD's existing site code (Next.js app at ../site). No per-project
 * scaffolding, no pnpm install for the user — uses the monorepo's already-
 * installed site workspace.
 *
 * Path X-1: run `next build` with GAD_PROJECT_ROOT env var set so planning
 * data comes from the target project. After the build, extract the pre-
 * rendered `/planning` HTML + static assets from `.next/` into a clean
 * output directory that's deployable as static files.
 *
 * Output shape:
 *   <out>/
 *   ├── index.html                    ← planning.html copy (home = planning page)
 *   ├── planning.html                 ← also at original route
 *   ├── planning.rsc                  ← RSC payload for hydration
 *   ├── planning.meta                 ← Next.js meta for the route
 *   ├── planning.segments/            ← nested segment RSC (if any)
 *   └── _next/
 *       └── static/                   ← JS chunks + CSS
 *           ├── chunks/**
 *           └── <buildId>/**
 *
 * Deployment: copy <out>/ to any static host. Vercel: deploy as framework
 * preset "Other", output directory = <out>.
 *
 * Public API:
 *   compileSite({ projectRoot, projectId, outDir, siteDir })
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    let total = 0;
    for (const entry of fs.readdirSync(src)) {
      total += copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return total;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return stat.size;
}

function resolveSiteDir(gadRoot) {
  // vendor/get-anything-done/site is the Next.js app we build.
  const siteDir = path.join(gadRoot, 'site');
  if (!fs.existsSync(path.join(siteDir, 'package.json'))) {
    throw new Error(`GAD site workspace not found at ${siteDir}. Expected package.json.`);
  }
  return siteDir;
}

function runBuild({ siteDir, projectRoot, projectId }) {
  const env = {
    ...process.env,
    GAD_PROJECT_ROOT: projectRoot,
    GAD_PROJECT_ID: projectId,
  };
  console.log(`[gad site] building with GAD_PROJECT_ROOT=${projectRoot}`);
  console.log('[gad site] this runs `next build` in the GAD site workspace — ~1-2 min');

  // Use the workspace's `next` binary directly (pnpm already linked it during
  // monorepo install). On Windows this is a .cmd batch file that spawnSync
  // can't launch directly without shell:true — run via node against Next's
  // JS entry file instead, which works cross-platform.
  const nextJs = path.join(siteDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  let cmd, args, useShell;
  if (fs.existsSync(nextJs)) {
    cmd = process.execPath; // node
    args = [nextJs, 'build'];
    useShell = false;
  } else {
    // Fallback: shell out to pnpm exec (requires pnpm in PATH).
    cmd = 'pnpm';
    args = ['exec', 'next', 'build'];
    useShell = true; // required for .cmd wrappers on Windows
  }

  const result = spawnSync(cmd, args, {
    cwd: siteDir,
    env,
    stdio: 'inherit',
    shell: useShell,
  });
  if (result.status !== 0) {
    throw new Error(
      `next build failed with exit code ${result.status}` +
        (result.error ? ` (${result.error.message})` : ''),
    );
  }
}

function extractPlanningSite({ siteDir, outDir }) {
  const nextDir = path.join(siteDir, '.next');
  const appDir = path.join(nextDir, 'server', 'app');
  const staticDir = path.join(nextDir, 'static');

  if (!fs.existsSync(appDir)) {
    throw new Error(`Expected .next/server/app at ${appDir} — did the build complete?`);
  }

  // Wipe prior output
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Copy the pre-rendered /planning route's static files.
  //    Next.js app router writes these as sibling files next to the
  //    segment name (planning.html, planning.rsc, planning.meta,
  //    planning.segments/).
  const planningFiles = ['planning.html', 'planning.rsc', 'planning.meta'];
  let total = 0;
  for (const f of planningFiles) {
    const src = path.join(appDir, f);
    if (fs.existsSync(src)) {
      total += copyRecursive(src, path.join(outDir, f));
    }
  }
  const segmentsDir = path.join(appDir, 'planning.segments');
  if (fs.existsSync(segmentsDir)) {
    total += copyRecursive(segmentsDir, path.join(outDir, 'planning.segments'));
  }

  // 2. Make /planning.html the root (index.html) so deploying to a static
  //    host serves the planning page as the home.
  const htmlSrc = path.join(outDir, 'planning.html');
  if (!fs.existsSync(htmlSrc)) {
    throw new Error('planning.html not found in build output — the /planning route may have failed to render');
  }
  fs.copyFileSync(htmlSrc, path.join(outDir, 'index.html'));

  // 3. Copy the Next.js static chunks (JS, CSS, buildId dir). The pre-rendered
  //    HTML references these via `/_next/static/*` absolute URLs — they need
  //    to be served from that exact path on the deploy host.
  if (fs.existsSync(staticDir)) {
    total += copyRecursive(staticDir, path.join(outDir, '_next', 'static'));
  }

  return { bytes: total };
}

/**
 * Main entry: compile a project's planning data into a static site.
 */
function compileSite({ projectRoot, projectId, outDir, siteDir }) {
  if (!projectRoot) throw new Error('projectRoot is required');
  if (!outDir) throw new Error('outDir is required');

  const absProjectRoot = path.resolve(projectRoot);
  const absOutDir = path.resolve(outDir);
  if (!fs.existsSync(absProjectRoot)) {
    throw new Error(`projectRoot does not exist: ${absProjectRoot}`);
  }
  if (!fs.existsSync(path.join(absProjectRoot, '.planning'))) {
    throw new Error(`no .planning/ found under ${absProjectRoot}`);
  }

  const id = projectId || path.basename(absProjectRoot);
  const gadRoot = path.resolve(__dirname, '..');
  const absSiteDir = siteDir ? path.resolve(siteDir) : resolveSiteDir(gadRoot);

  runBuild({ siteDir: absSiteDir, projectRoot: absProjectRoot, projectId: id });

  console.log(`[gad site] extracting /planning route → ${absOutDir}`);
  const { bytes } = extractPlanningSite({ siteDir: absSiteDir, outDir: absOutDir });

  const mb = (bytes / (1024 * 1024)).toFixed(1);
  console.log(`[gad site] compiled ${id} → ${absOutDir} (${mb} MB)`);
  console.log(`[gad site] deploy: cd ${outDir} && vercel    (or any static host)`);

  return { outDir: absOutDir, bytes };
}

/**
 * Minimal static file server for `gad site serve`. Serves the output dir
 * on the given port with no caching so the user can refresh after re-compile.
 */
function serveStatic({ rootDir, port, host }) {
  const http = require('http');
  const port_ = port || 3456;
  const host_ = host || '127.0.0.1';

  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.rsc': 'text/x-component; charset=utf-8',
    '.meta': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  };

  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const safePath = path.normalize(urlPath).replace(/^(\.\.[\\/])+/, '');
    let filePath = path.join(rootDir, safePath);

    // Directory → index.html fallback
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    } catch {}

    // Try adding .html if missing (so /planning works as well as /planning.html)
    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      if (fs.existsSync(filePath + '.html')) filePath += '.html';
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${urlPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port_, host_, () => {
    console.log(`[gad site] serving ${rootDir}`);
    console.log(`[gad site] http://${host_}:${port_}/`);
    console.log('[gad site] press ctrl+c to stop');
  });

  return server;
}

module.exports = { compileSite, serveStatic, extractPlanningSite };
