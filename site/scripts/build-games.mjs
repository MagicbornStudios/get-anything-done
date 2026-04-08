#!/usr/bin/env node
/**
 * Builds each eval run's Vite source (run/) into a static dist and copies the
 * result into site/public/playable/<project>/<version>/ so the landing page
 * can embed it in an iframe.
 *
 * - Only touches runs that have run/package.json and don't already have
 *   public/playable/<project>/<version>/index.html
 * - Uses `npx vite build --base ./` so all asset paths are relative
 * - Skips runs whose npm install or build fails, logging the error
 *
 * Intended to run LOCALLY before committing the generated dist files to git.
 * Do NOT run this on Vercel — the npm installs would balloon build time.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const EVALS_DIR = path.join(REPO_ROOT, "evals");
const PLAYABLE_DIR = path.join(SITE_ROOT, "public", "playable");

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function rmrf(p) { if (exists(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(sp, dp);
    else if (entry.isFile()) fs.copyFileSync(sp, dp);
  }
}

function run(cmd, cwd) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function findRuns() {
  const runs = [];
  for (const project of fs.readdirSync(EVALS_DIR).sort()) {
    const pd = path.join(EVALS_DIR, project);
    if (!fs.statSync(pd).isDirectory()) continue;
    if (project.startsWith(".")) continue;
    for (const version of fs.readdirSync(pd).sort()) {
      if (!/^v\d+$/.test(version)) continue;
      const runDir = path.join(pd, version, "run");
      if (exists(path.join(runDir, "package.json"))) {
        runs.push({ project, version, runDir });
      } else {
        // Some legacy runs have game/dist directly.
        const gameDist = path.join(pd, version, "game", "dist", "index.html");
        if (exists(gameDist)) {
          runs.push({ project, version, prebuiltDist: path.dirname(gameDist) });
        }
      }
    }
  }
  return runs;
}

function buildOne(run) {
  const dest = path.join(PLAYABLE_DIR, run.project, run.version);
  if (exists(path.join(dest, "index.html"))) {
    console.log(`[skip] ${run.project}/${run.version} — already built`);
    return { ok: true, skipped: true };
  }

  if (run.prebuiltDist) {
    console.log(`[copy] ${run.project}/${run.version} ← prebuilt ${run.prebuiltDist}`);
    ensureDir(dest);
    copyDir(run.prebuiltDist, dest);
    // rewrite absolute /assets/ paths to ./assets/ for subdirectory serving
    const indexPath = path.join(dest, "index.html");
    if (exists(indexPath)) {
      const html = fs.readFileSync(indexPath, "utf8").replace(/(["'])\//g, "$1./");
      fs.writeFileSync(indexPath, html, "utf8");
    }
    return { ok: true, copied: true };
  }

  console.log(`[build] ${run.project}/${run.version}`);
  try {
    if (!exists(path.join(run.runDir, "node_modules"))) {
      run.installed = true;
      // eslint-disable-next-line no-useless-call
      execSync("npm install --no-audit --no-fund --loglevel=error", {
        cwd: run.runDir,
        stdio: "inherit",
      });
    }
    execSync("npx vite build --base ./", { cwd: run.runDir, stdio: "inherit" });
  } catch (err) {
    console.error(`[fail] ${run.project}/${run.version}: ${err.message}`);
    return { ok: false };
  }
  const dist = path.join(run.runDir, "dist");
  if (!exists(path.join(dist, "index.html"))) {
    console.error(`[fail] ${run.project}/${run.version}: dist/index.html missing after build`);
    return { ok: false };
  }
  rmrf(dest);
  copyDir(dist, dest);
  return { ok: true };
}

function main() {
  console.log("=== build-games ===");
  ensureDir(PLAYABLE_DIR);
  const runs = findRuns();
  const results = runs.map((r) => {
    const result = buildOne(r);
    return { ...r, ...result };
  });
  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  console.log(`\n=== done ===  ok=${ok}  fail=${fail}`);
  if (fail > 0) {
    console.log("Failed runs:", results.filter((r) => !r.ok).map((r) => `${r.project}/${r.version}`).join(", "));
    process.exit(1);
  }
}

main();
