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

  let total = 0;

  // 1. Copy EVERY pre-rendered route from .next/server/app/ so all nav links
  //    resolve on the deployed site. Next.js app router emits a parallel tree
  //    of .html / .rsc / .meta / .segments files — copy the whole thing and
  //    let the static host serve it directly.
  //
  //    Skip Next.js internals that start with `_` EXCEPT `_not-found.*` which
  //    we rename to `404.html` below so the static host can surface the
  //    real Next.js 404 page when routes miss.
  for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
    const name = entry.name;
    // Skip Next.js internals
    if (name.startsWith('_global-error')) continue;
    if (name.startsWith('_not-found')) continue; // handled below
    const src = path.join(appDir, name);
    const dest = path.join(outDir, name);
    total += copyRecursive(src, dest);
  }

  // 2. Special-case `_not-found.html` → `404.html`. Vercel + most static hosts
  //    serve `404.html` from the site root when a path isn't found.
  const notFoundHtml = path.join(appDir, '_not-found.html');
  if (fs.existsSync(notFoundHtml)) {
    fs.copyFileSync(notFoundHtml, path.join(outDir, '404.html'));
    total += fs.statSync(notFoundHtml).size;
  }

  // 3. Make `/planning.html` the default home page. When someone hits the
  //    deployed site's root, they land on the planning dashboard.
  const planningHtml = path.join(outDir, 'planning.html');
  if (!fs.existsSync(planningHtml)) {
    throw new Error('planning.html not found in build output — the /planning route may have failed to render');
  }
  fs.copyFileSync(planningHtml, path.join(outDir, 'index.html'));

  // 4. Copy the Next.js static chunks (JS, CSS, buildId dir). The pre-rendered
  //    HTML references these via `/_next/static/*` absolute URLs — they need
  //    to be served from that exact path on the deploy host.
  if (fs.existsSync(staticDir)) {
    total += copyRecursive(staticDir, path.join(outDir, '_next', 'static'));
  }

  // Count how many routes we landed so the caller can log it.
  const routeCount = countHtmlFiles(outDir);

  return { bytes: total, routes: routeCount };
}

function countHtmlFiles(dir) {
  let n = 0;
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_next') continue; // skip assets dir
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        n += 1;
      }
    }
  }
  walk(dir);
  return n;
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

  console.log(`[gad site] extracting all pre-rendered routes → ${absOutDir}`);
  const { bytes, routes } = extractPlanningSite({ siteDir: absSiteDir, outDir: absOutDir });

  const mb = (bytes / (1024 * 1024)).toFixed(1);
  console.log(`[gad site] compiled ${id} → ${absOutDir} (${routes} routes, ${mb} MB)`);
  console.log(`[gad site] home: /planning (rendered as index.html)`);
  console.log(`[gad site] deploy: cd ${outDir} && vercel    (or any static host)`);

  return { outDir: absOutDir, bytes, routes };
}

const { serveStatic: serveStaticHttp } = require('./static-http-serve.cjs');

/** Thin wrapper so `gad site serve` keeps the `[gad site]` log prefix (gad-225). */
function serveStatic(opts) {
  return serveStaticHttp({ ...opts, logPrefix: opts && opts.logPrefix != null ? opts.logPrefix : '[gad site]' });
}

module.exports = { compileSite, serveStatic, extractPlanningSite };
