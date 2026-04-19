#!/usr/bin/env node
/**
 * Pack the GAD planning site as a self-contained release zip (task 44-33e).
 *
 * Reads the standalone Next.js build at site/.next/standalone/ + site/.next/static/
 * + site/public/ + site/scripts/launcher.cjs, copies everything into
 * dist/release/site-v<version>/, and writes dist/release/site-v<version>.zip.
 *
 * Pre-conditions:
 *   - `next.config.mjs` has `output: "standalone"` (already set after 44-33a)
 *   - `next build` has been run inside site/ (or `pnpm --filter @get-anything-done/site build`)
 *
 * The resulting zip is the artifact that:
 *   (a) ships as a release asset alongside get-anything-done-<version>.tgz, and
 *   (b) gets pulled by `bin/install.js --site --from-release v<tag>` into
 *       <consumer>/.planning/site/
 *
 * Bundled portable Node (44-33b/44-34) is a separate concern handled by the
 * release pipeline. The launcher will attempt `node server.js` from PATH;
 * the portable-Node bootstrap will eventually drop a private node.exe at
 * .planning/.node/ and the launcher (or wrapping shim) will prefer that.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const os = require("node:os");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SITE_DIR = path.join(REPO_ROOT, "site");
const STANDALONE_DIR = path.join(SITE_DIR, ".next", "standalone");
const STATIC_DIR = path.join(SITE_DIR, ".next", "static");
const PUBLIC_DIR = path.join(SITE_DIR, "public");
const LAUNCHER = path.join(SITE_DIR, "scripts", "launcher.cjs");

const PKG = require(path.join(REPO_ROOT, "package.json"));
const VERSION = PKG.version;
const RELEASE_DIR = path.join(REPO_ROOT, "dist", "release");
const STAGE_DIR = path.join(RELEASE_DIR, `site-v${VERSION}`);
const ZIP_PATH = path.join(RELEASE_DIR, `site-v${VERSION}.zip`);

function die(msg, code = 1) {
  console.error(`[pack-site-release] ERROR: ${msg}`);
  process.exit(code);
}

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(srcPath);
      try { fs.symlinkSync(link, destPath); }
      catch { fs.copyFileSync(srcPath, destPath); }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function checkPrereqs() {
  if (!fs.existsSync(STANDALONE_DIR)) {
    die(`missing ${STANDALONE_DIR}\n  run: pnpm --filter @get-anything-done/site build (with output:"standalone" in next.config.mjs)`);
  }
  if (!fs.existsSync(LAUNCHER)) {
    die(`missing launcher at ${LAUNCHER}`);
  }
  if (!fs.existsSync(path.join(STANDALONE_DIR, "server.js"))) {
    die(`standalone build at ${STANDALONE_DIR} has no server.js — was Next built with output:"standalone"?`);
  }
}

function stage() {
  rimraf(STAGE_DIR);
  fs.mkdirSync(STAGE_DIR, { recursive: true });

  // 1. Standalone tree (server.js + node_modules subset + .next + package.json)
  copyTree(STANDALONE_DIR, STAGE_DIR);

  // 2. Static assets — Next standalone needs .next/static/ copied alongside server.js
  const stagedNextStatic = path.join(STAGE_DIR, ".next", "static");
  if (fs.existsSync(STATIC_DIR)) {
    copyTree(STATIC_DIR, stagedNextStatic);
  }

  // 3. public/ → ./public/ (next standalone reads from cwd/public/)
  if (fs.existsSync(PUBLIC_DIR)) {
    copyTree(PUBLIC_DIR, path.join(STAGE_DIR, "public"));
  }

  // 4. Launcher + README
  fs.copyFileSync(LAUNCHER, path.join(STAGE_DIR, "launcher.cjs"));

  // 4b. Optional Bun --compile'd launcher.exe (44-33c — replaces the
  //     cancelled portable-Node bootstrap from 44-34). When Bun is
  //     available at pack time, produce per-platform compiled launchers
  //     so end users with no Node on PATH can still double-click.
  compileBunLauncher();
  const readme = [
    "GAD planning site — self-contained release",
    `version: ${VERSION}`,
    "",
    "Quick start:",
    "  Windows:    .\\launcher-windows-x64.exe   (no Node required)",
    "  macOS:      ./launcher-darwin-x64        (no Node required)",
    "  Linux:      ./launcher-linux-x64         (no Node required)",
    "  Anywhere:   node launcher.cjs            (Node-shim fallback)",
    "",
    "The .exe variants bundle a self-contained Bun runtime, so you can",
    "double-click them with no Node install. They are larger (~110 MB).",
    "If Node is already on your PATH, prefer the lightweight launcher.cjs.",
    "",
    "The launcher binds a free port in 5560–5599 and opens your default",
    "browser at http://127.0.0.1:<port>/.",
    "",
    "Env knobs:",
    "  GAD_SITE_PORT=<n>           pin a port",
    "  GAD_SITE_HOST=<addr>        bind host (default 127.0.0.1)",
    "  GAD_SITE_NO_BROWSER=1       skip auto-open",
    "  GAD_PLANNING_DIR=<abs>      override which .planning/ the site reads",
    "  GAD_LAUNCHER_FORCE_SPAWN=1  force Node-subprocess mode from .exe",
    "",
    "See references/installer-feature-flags.md in the get-anything-done",
    "repo for the full reference.",
    "",
  ].join(os.EOL);
  fs.writeFileSync(path.join(STAGE_DIR, "README.txt"), readme, "utf8");
}

function detectBun() {
  const probe = spawnSync("bun", ["--version"], { stdio: "pipe", encoding: "utf8" });
  if (probe.status === 0) {
    const ver = (probe.stdout || "").trim();
    return { available: true, version: ver };
  }
  return { available: false };
}

// Compile launcher.cjs into platform-native binaries with `bun build --compile`.
// Defaults to the current host platform; pass GAD_LAUNCHER_TARGETS env to
// force a list (comma-separated, e.g. "bun-windows-x64,bun-linux-x64,bun-darwin-x64").
// Failures are non-fatal: launcher.cjs (Node-shim) is always shipped, so a
// missing .exe just degrades to "consumer needs node on PATH".
function compileBunLauncher() {
  const bun = detectBun();
  if (!bun.available) {
    console.log(`[pack-site-release] Bun not detected — skipping launcher.exe compile (launcher.cjs Node-shim still ships)`);
    return;
  }
  console.log(`[pack-site-release] Bun ${bun.version} detected — compiling launcher.exe`);

  const explicit = (process.env.GAD_LAUNCHER_TARGETS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const targets = explicit.length > 0 ? explicit : [hostBunTarget()];

  for (const target of targets) {
    const ext = target.startsWith("bun-windows") ? ".exe" : "";
    const outname = `launcher-${target.replace(/^bun-/, "")}${ext}`;
    const outpath = path.join(STAGE_DIR, outname);
    console.log(`  → ${target} → ${outname}`);
    const result = spawnSync(
      "bun",
      ["build", "--compile", `--target=${target}`, LAUNCHER, "--outfile", outpath],
      { stdio: "inherit" }
    );
    if (result.status !== 0 || !fs.existsSync(outpath)) {
      console.warn(`  ⚠ bun --compile failed for ${target} (non-fatal — Node-shim launcher.cjs still ships)`);
      continue;
    }
    const sz = fs.statSync(outpath).size;
    console.log(`  ✓ ${outname} · ${(sz / 1024 / 1024).toFixed(2)} MB`);
  }
}

function hostBunTarget() {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  if (process.platform === "win32") return `bun-windows-${arch}`;
  if (process.platform === "darwin") return `bun-darwin-${arch}`;
  return `bun-linux-${arch}`;
}

function makeZip() {
  // Cross-platform zip: prefer 7z on Windows, then PowerShell Compress-Archive,
  // then `zip` on POSIX. Bail loudly if none available — release pipeline
  // assumes the next iteration installs whichever of these the host needs.
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

  const candidates = [];
  if (process.platform === "win32") {
    candidates.push({
      cmd: "powershell.exe",
      args: ["-NoProfile", "-Command", `Compress-Archive -Path '${STAGE_DIR}\\*' -DestinationPath '${ZIP_PATH}' -Force`],
    });
    candidates.push({ cmd: "7z", args: ["a", "-tzip", ZIP_PATH, path.join(STAGE_DIR, "*")] });
  } else {
    candidates.push({ cmd: "zip", args: ["-r", ZIP_PATH, "."], cwd: STAGE_DIR });
    candidates.push({ cmd: "7z", args: ["a", "-tzip", ZIP_PATH, path.join(STAGE_DIR, "*")] });
  }

  for (const c of candidates) {
    const result = spawnSync(c.cmd, c.args, { cwd: c.cwd, stdio: "inherit" });
    if (result.status === 0 && fs.existsSync(ZIP_PATH)) {
      return c.cmd;
    }
  }
  die(`no working zip tool found (tried: ${candidates.map(c => c.cmd).join(", ")})`);
}

function ensureFrameworkGraph() {
  // Post-2026-04-19: .planning/graph.{json,html} are gitignored. The site
  // build (build-site-data.mjs) reads .planning/graph.json to populate
  // site/data/planning-graph.json — if the framework's graph is missing
  // when pack:site runs, the baked-in graph is an empty stub. Call the
  // local CLI to rebuild before the consumer ever runs `next build`.
  // Non-fatal: build-site-data.mjs degrades gracefully to a stub.
  const planningGraph = path.join(REPO_ROOT, ".planning", "graph.json");
  if (fs.existsSync(planningGraph)) return;
  console.log(`[pack-site-release] .planning/graph.json missing — rebuilding via gad graph build`);
  const cli = path.join(REPO_ROOT, "bin", "gad.cjs");
  const result = spawnSync(process.execPath, [cli, "graph", "build", "--projectid", "get-anything-done"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.warn(`[pack-site-release] gad graph build exited with status ${result.status} — site bundle will ship with stub graph`);
  }
}

function warnIfTraceMissing() {
  // Post-2026-04-19: .planning/.trace-events.jsonl + .planning/.gad-log/
  // are gitignored (per-CLI-call append-only logs that caused 95+ commits/
  // 60d of pure noise and guaranteed multi-agent merge conflicts). The
  // site build's compute-self-eval.mjs reads them to derive site/data/
  // self-eval.json — when missing, self-eval just degrades to an empty
  // stub. Surface a non-fatal warning so packagers know the release will
  // ship with empty self-eval data rather than the framework's actual
  // self-evaluation history.
  const trace = path.join(REPO_ROOT, ".planning", ".trace-events.jsonl");
  const gadLog = path.join(REPO_ROOT, ".planning", ".gad-log");
  const hasTrace = fs.existsSync(trace);
  const hasLog = fs.existsSync(gadLog) && fs.readdirSync(gadLog).some((f) => f.endsWith(".jsonl"));
  if (!hasTrace && !hasLog) {
    console.warn(`[pack-site-release] no .trace-events.jsonl or .gad-log/ found — site/data/self-eval.json will ship as empty stub (this is fine for CLI-only contributors who haven't run gad locally)`);
  }
}

function main() {
  checkPrereqs();
  ensureFrameworkGraph();
  warnIfTraceMissing();
  console.log(`[pack-site-release] staging ${STAGE_DIR}`);
  stage();
  console.log(`[pack-site-release] zipping → ${ZIP_PATH}`);
  const tool = makeZip();
  const stat = fs.statSync(ZIP_PATH);
  console.log(`[pack-site-release] OK · ${(stat.size / 1024 / 1024).toFixed(2)} MB · zipped via ${tool}`);
  console.log(`[pack-site-release] release asset: ${path.relative(REPO_ROOT, ZIP_PATH)}`);
}

main();
