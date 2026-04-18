#!/usr/bin/env node
/**
 * Prebuild data generator for the GAD landing site.
 *
 * Runs before `next build`. Responsible for:
 *  1. Zipping the canonical GAD pack template (../../templates) into
 *     public/downloads/gad-pack-template.zip
 *  2. Zipping each eval project's template/ into
 *     public/downloads/eval-<project>-template.zip
 *  3. Parsing every evals/<project>/v<N>/TRACE.json into
 *     lib/eval-data.generated.ts (rich structure consumed by the landing UI)
 *  4. Copying pre-built game dist/ dirs into public/playable/<project>/<version>/
 *     (builds produced separately by scripts/build-games.mjs)
 *
 * All I/O is synchronous and deterministic so the output is cacheable.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { marked } from "marked";

// Import CLI lib/ readers (CJS) via createRequire for parser consolidation (gad-126)
const require = createRequire(import.meta.url);
const { readDecisions } = require("../../lib/decisions-reader.cjs");
const { readPhases } = require("../../lib/roadmap-reader.cjs");
const { readTasks } = require("../../lib/task-registry-reader.cjs");
const { summarizeAgentLineage } = require("../../lib/eval-agent-lineage.cjs");
const gadConfig = require("../../bin/gad-config.cjs");
// Task 42.4-15, decision gad-184: project âŠ‡ species inheritance contract.
// Species metadata must be loaded through the canonical merger so the site
// sees the same shape as the CLI and the forge editor.
const {
  loadResolvedSpecies: loadResolvedSpeciesMerged,
} = require("../../lib/eval-loader.cjs");

// Render markdown to HTML deterministically. GitHub flavoured, no sanitizer
// because the content is authored in this repo and static at build time.
marked.setOptions({ gfm: true, breaks: false });
function renderMarkdown(src) {
  if (!src) return "";
  try {
    return marked.parse(src, { async: false });
  } catch (err) {
    console.warn("  [warn] markdown render failed:", err.message);
    return `<pre>${src.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>`;
  }
}

/** Agent frontmatter `tools` may be a string, YAML list, or (buggy) `{}` â€” catalog types expect `string | null`. */
function normalizeAgentToolsField(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((x) => String(x)).join(", ");
  if (typeof value === "object") {
    if (Object.keys(value).length === 0) return null;
    return JSON.stringify(value);
  }
  return String(value);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");

// Phase 10: `gad site compile` can point the planning-data readers at an
// external project root via GAD_PROJECT_ROOT. Everything ELSE (skills, agents,
// evals, templates, framework assets) still reads from REPO_ROOT â€” those are GAD framework
// artifacts that don't change per project. Default: GAD's own root for
// backwards-compat with the existing GAD landing site build.
const PROJECT_ROOT = process.env.GAD_PROJECT_ROOT
  ? path.resolve(process.env.GAD_PROJECT_ROOT)
  : REPO_ROOT;
const PROJECT_ID = process.env.GAD_PROJECT_ID
  || (PROJECT_ROOT === REPO_ROOT ? "get-anything-done" : path.basename(PROJECT_ROOT));
if (PROJECT_ROOT !== REPO_ROOT) {
  console.log(`  [project-mode] reading planning data from ${PROJECT_ROOT} (id=${PROJECT_ID})`);
}

const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");
const SKILLS_DIR = path.join(REPO_ROOT, "skills");
const AGENTS_DIR = path.join(REPO_ROOT, "agents");
const EVALS_DIR = path.join(REPO_ROOT, "evals");

// -------------------------------------------------------------------------
// Multi-root eval discovery (task 44-02, mirrors bin/gad.cjs::getEvalRoots).
// The submodule's own `evals/` dir is the implicit default; any additional
// [[evals.roots]] declared in gad-config.toml (searched upward from the
// repo root) are included. Duplicate project ids across roots throw.
// -------------------------------------------------------------------------
function getEvalRoots() {
  const defaultRoot = { id: "get-anything-done", dir: EVALS_DIR };

  let configuredRoots = [];
  try {
    // findRepoRoot for build-site-data: walk upward from the site's repo
    // parent looking for a config that carries [[evals.roots]]. The monorepo
    // gad-config.toml sits at custom_portfolio/gad-config.toml, two levels
    // above vendor/get-anything-done.
    const candidates = new Set();
    let dir = REPO_ROOT;
    for (let i = 0; i < 8; i += 1) {
      candidates.add(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    for (const base of candidates) {
      try {
        const cfg = gadConfig.load(base);
        if (cfg && Array.isArray(cfg.evalsRoots) && cfg.evalsRoots.length > 0) {
          configuredRoots = cfg.evalsRoots
            .filter((r) => r && r.enabled !== false && r.path)
            .map((r) => ({
              id: r.id || path.basename(r.path),
              dir: path.isAbsolute(r.path) ? r.path : path.resolve(base, r.path),
            }));
          break;
        }
      } catch {}
    }
  } catch {
    configuredRoots = [];
  }

  const seen = new Set();
  const ordered = [];
  for (const r of configuredRoots) {
    const key = path.resolve(r.dir).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(r);
  }
  const defaultKey = path.resolve(defaultRoot.dir).toLowerCase();
  if (!seen.has(defaultKey)) ordered.push(defaultRoot);
  return ordered;
}

function listEvalProjectDirs() {
  const byName = new Map();
  for (const root of getEvalRoots()) {
    if (!exists(root.dir)) continue;
    let entries;
    try { entries = fs.readdirSync(root.dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
      const projectDir = path.join(root.dir, e.name);
      if (byName.has(e.name)) {
        const existing = byName.get(e.name);
        throw new Error(
          `Duplicate eval project id "${e.name}" in multiple roots:\n  ${existing.projectDir}\n  ${projectDir}`,
        );
      }
      byName.set(e.name, { project: e.name, projectDir, root });
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.project.localeCompare(b.project));
}
const WORKFLOWS_DIR = path.join(REPO_ROOT, ".planning", "workflows");
const HUMAN_WORKFLOWS_DIR = path.join(REPO_ROOT, ".planning", "human-workflows");
const CONTEXT_FRAMEWORKS_DIR = path.join(REPO_ROOT, ".planning", "context-frameworks");
const DATA_DIR = path.join(REPO_ROOT, "data");
const SITE_DATA_DIR = path.join(SITE_ROOT, "data");
const DB_JSON_FILE = path.join(SITE_DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(SITE_ROOT, "public");
const DOWNLOADS_DIR = path.join(PUBLIC_DIR, "downloads");
const REQUIREMENTS_DIR = path.join(DOWNLOADS_DIR, "requirements");
const PLANNING_ZIPS_DIR = path.join(DOWNLOADS_DIR, "planning");
const PLAYABLE_DIR = path.join(PUBLIC_DIR, "playable");
const GENERATED_FILE = path.join(SITE_ROOT, "lib", "eval-data.generated.ts");
const CATALOG_FILE = path.join(SITE_ROOT, "lib", "catalog.generated.ts");
const PROJECT_CONFIG_FILE = path.join(SITE_ROOT, "lib", "project-config.generated.ts");
const DEVID_PROMPTS_FILE = path.join(SITE_ROOT, "lib", "devid-prompts.generated.ts");

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------------
// Eval layout helpers (phase 43 schema)
// -------------------------------------------------------------------------
// Phase 43 unified the eval layout: every project lives in evals/<project>/
// and contains a project.json plus species/<species>/ subdirs. Each species
// has its own species.json plus generation subdirs (v1, v2, ...). These helpers
// flatten that hierarchy so walker code can iterate species rows or
// generation rows without re-implementing the directory shape every time.

function listEvalSpecies() {
  const out = [];
  for (const { project: projectName, projectDir } of listEvalProjectDirs()) {
    const speciesRoot = path.join(projectDir, "species");
    if (!exists(speciesRoot)) continue;
    for (const speciesName of fs.readdirSync(speciesRoot).sort()) {
      const dir = path.join(speciesRoot, speciesName);
      let s;
      try { s = fs.statSync(dir); } catch { continue; }
      if (!s.isDirectory()) continue;
      const speciesJsonPath = path.join(dir, "species.json");
      if (!exists(speciesJsonPath)) continue;
      out.push({
        project: projectName,
        species: speciesName,
        id: `${projectName}/${speciesName}`,
        dir,
        projectDir,
        speciesJsonPath,
        templateDir: path.join(dir, "template"),
      });
    }
  }
  return out;
}

function listEvalGenerations() {
  const out = [];
  for (const sp of listEvalSpecies()) {
    let entries;
    try { entries = fs.readdirSync(sp.dir).sort(); } catch { continue; }
    for (const v of entries) {
      if (!/^v\d+$/.test(v)) continue;
      const dir = path.join(sp.dir, v);
      let s;
      try { s = fs.statSync(dir); } catch { continue; }
      if (!s.isDirectory()) continue;
      out.push({
        project: sp.project,
        species: sp.species,
        version: v,
        // composite id used as a stable key for generation rows
        id: `${sp.project}/${sp.species}/${v}`,
        dir,
        runDir: path.join(dir, "run"),
        speciesDir: sp.dir,
        projectDir: sp.projectDir,
      });
    }
  }
  return out;
}

function listEvalProjects() {
  const out = [];
  for (const { project: projectName, projectDir } of listEvalProjectDirs()) {
    const projectJsonPath = path.join(projectDir, "project.json");
    if (!exists(projectJsonPath)) continue;
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(projectJsonPath, "utf8")); } catch {}
    out.push({
      project: projectName,
      dir: projectDir,
      projectJsonPath,
      meta,
    });
  }
  return out;
}

function rmrf(p) {
  if (exists(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(sp, dp);
    else if (entry.isFile()) fs.copyFileSync(sp, dp);
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Tiny frontmatter parser. Handles the `---\n...\n---\n<body>` shape.
 * Returns { data, body }. Only understands key: value (strings, one level).
 */
/**
 * Minimal frontmatter parser. Supports:
 *  - top-level key: value
 *  - top-level key: [a, b, c] inline arrays
 *  - one level of nesting via indented sub-keys under a bare `key:`
 *    (sub-values may themselves be inline arrays)
 *  - the literal `null`
 */
function parseFrontmatter(src) {
  if (!src.startsWith("---")) return { data: {}, body: src };
  const end = src.indexOf("\n---", 3);
  if (end < 0) return { data: {}, body: src };
  const header = src.slice(3, end).trim();
  const body = src.slice(end + 4).replace(/^\n/, "");
  const data = {};

  const lines = header.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }
    const top = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!top || /^\s/.test(line)) {
      // Orphan continuation â€” append to the last key as string
      i += 1;
      continue;
    }
    const key = top[1];
    const inlineValue = top[2];

    if (inlineValue.length > 0) {
      data[key] = decodeFrontmatterValue(inlineValue);
      i += 1;
      continue;
    }

    // Bare key â€” consume indented block as a nested object
    const nested = {};
    i += 1;
    while (i < lines.length) {
      const sub = lines[i];
      if (!/^\s+/.test(sub) || /^\s*$/.test(sub)) break;
      const subMatch = sub.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!subMatch) {
        i += 1;
        continue;
      }
      nested[subMatch[1]] = decodeFrontmatterValue(subMatch[2]);
      i += 1;
    }
    data[key] = nested;
  }

  return { data, body };
}

function decodeFrontmatterValue(raw) {
  const v = (raw || "").trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v.startsWith("[") && v.endsWith("]")) {
    return v
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  return v.replace(/^["']|["']$/g, "");
}

function firstParagraph(text, max = 600) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  // Skip a leading # Heading line.
  const lines = trimmed.split("\n");
  let i = 0;
  while (i < lines.length && /^\s*#/.test(lines[i])) i++;
  while (i < lines.length && !lines[i].trim()) i++;
  const chunks = [];
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) break;
    chunks.push(line);
    i++;
  }
  const result = chunks.join(" ").replace(/\s+/g, " ").trim();
  return result.length > max ? result.slice(0, max - 1) + "â€¦" : result;
}

function gitShow(ref, repoRelPath) {
  try {
    return execSync(`git -C "${REPO_ROOT}" show ${ref}:${repoRelPath}`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString("utf8");
  } catch {
    return null;
  }
}

// Skip these patterns when zipping â€” keeps downloads lean.
const ZIP_SKIP = new Set(["node_modules", ".git", "dist", ".next"]);

function shouldSkipForZip(name) {
  return ZIP_SKIP.has(name) || name.startsWith(".DS_Store");
}

function zipDirectory(srcDir, zipPath, label) {
  if (!exists(srcDir)) {
    console.warn(`  [skip] ${label}: ${srcDir} not found`);
    return null;
  }
  const zip = new AdmZip();
  // Use a relative inner root named after the dir so extraction is predictable.
  const innerRoot = path.basename(srcDir);
  function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (shouldSkipForZip(entry.name)) continue;
      const sp = path.join(dir, entry.name);
      const r = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) walk(sp, r);
      else if (entry.isFile()) {
        const buf = fs.readFileSync(sp);
        zip.addFile(r, buf);
      }
    }
  }
  walk(srcDir, innerRoot);
  ensureDir(path.dirname(zipPath));
  zip.writeZip(zipPath);
  const size = fs.statSync(zipPath).size;
  console.log(`  [zip] ${label} â†’ ${path.relative(SITE_ROOT, zipPath)} (${formatBytes(size)})`);
  return { path: path.relative(PUBLIC_DIR, zipPath).split(path.sep).join("/"), bytes: size };
}

// -------------------------------------------------------------------------
// 1. GAD pack template zip
// -------------------------------------------------------------------------

function zipGadPackTemplate() {
  console.log("[1/4] Zipping GAD pack template");
  const zipPath = path.join(DOWNLOADS_DIR, "gad-pack-template.zip");
  return zipDirectory(TEMPLATES_DIR, zipPath, "gad-pack-template");
}

// -------------------------------------------------------------------------
// 2. Per-eval template zips
// -------------------------------------------------------------------------

function zipEvalTemplates() {
  console.log("[2/4] Zipping per-eval templates");
  const results = [];
  for (const sp of listEvalSpecies()) {
    if (!exists(sp.templateDir)) continue;
    const slug = `${sp.project}-${sp.species}`;
    const zipPath = path.join(DOWNLOADS_DIR, `eval-${slug}-template.zip`);
    const entry = zipDirectory(sp.templateDir, zipPath, `eval:${slug}`);
    if (entry) {
      results.push({
        project: sp.project,
        species: sp.species,
        id: sp.id,
        zipPath: `/${entry.path}`,
        bytes: entry.bytes,
      });
    }
  }
  return results;
}

// -------------------------------------------------------------------------
// 2b. Planning-only zips (no source code) â€” bundles just the planning
// artifacts a human would read to understand the eval: .planning/, skills/,
// AGENTS.md, REQUIREMENTS.xml or REQUIREMENTS.md, source-*.xml design docs.
// -------------------------------------------------------------------------

const PLANNING_INCLUDE_FILES = new Set([
  "AGENTS.md",
  "REQUIREMENTS.xml",
  "REQUIREMENTS.md",
  "WORKFLOW.md",
  "CHANGELOG.md",
]);
const PLANNING_INCLUDE_DIRS = new Set([".planning", "skills", "planning"]);
function isPlanningFile(relName) {
  if (PLANNING_INCLUDE_FILES.has(relName)) return true;
  if (relName.startsWith("source-") && (relName.endsWith(".md") || relName.endsWith(".xml")))
    return true;
  if (relName.startsWith("_brownfield") && relName.endsWith(".md")) return true;
  return false;
}

function zipPlanningOnly(srcDir, zipPath, label) {
  if (!exists(srcDir)) {
    console.warn(`  [skip] ${label}: ${srcDir} not found`);
    return null;
  }
  const zip = new AdmZip();
  const innerRoot = path.basename(srcDir);
  let fileCount = 0;
  function walkIncludeDir(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (shouldSkipForZip(entry.name)) continue;
      const sp = path.join(dir, entry.name);
      const r = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) walkIncludeDir(sp, r);
      else if (entry.isFile()) {
        zip.addFile(r, fs.readFileSync(sp));
        fileCount++;
      }
    }
  }
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (shouldSkipForZip(entry.name)) continue;
    const sp = path.join(srcDir, entry.name);
    const r = path.posix.join(innerRoot, entry.name);
    if (entry.isDirectory()) {
      if (PLANNING_INCLUDE_DIRS.has(entry.name)) walkIncludeDir(sp, r);
    } else if (entry.isFile()) {
      if (isPlanningFile(entry.name)) {
        zip.addFile(r, fs.readFileSync(sp));
        fileCount++;
      }
    }
  }
  if (fileCount === 0) return null;
  ensureDir(path.dirname(zipPath));
  zip.writeZip(zipPath);
  const size = fs.statSync(zipPath).size;
  console.log(`  [zip] planning:${label} â†’ ${path.relative(SITE_ROOT, zipPath)} (${formatBytes(size)}, ${fileCount} files)`);
  return { path: path.relative(PUBLIC_DIR, zipPath).split(path.sep).join("/"), bytes: size, files: fileCount };
}

function zipPlanningOnlyPerEval() {
  console.log("[2b/4] Zipping planning-only per eval");
  const results = [];
  for (const sp of listEvalSpecies()) {
    if (!exists(sp.templateDir)) continue;
    const slug = `${sp.project}-${sp.species}`;
    const zipPath = path.join(PLANNING_ZIPS_DIR, `eval-${slug}-planning.zip`);
    const entry = zipPlanningOnly(sp.templateDir, zipPath, slug);
    if (entry) {
      results.push({
        project: sp.project,
        species: sp.species,
        id: sp.id,
        zipPath: `/${entry.path}`,
        bytes: entry.bytes,
        files: entry.files,
      });
    }
  }
  return results;
}

// -------------------------------------------------------------------------
// 3. Parse all TRACE.json files into rich eval data
// -------------------------------------------------------------------------

function findTraceFiles() {
  const traces = [];
  for (const gen of listEvalGenerations()) {
    const traceFile = path.join(gen.dir, "TRACE.json");
    if (!exists(traceFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(traceFile, "utf8"));
      traces.push({ project: gen.project, species: gen.species, version: gen.version, id: gen.id, data });
    } catch (err) {
      console.warn(`  [warn] failed to parse ${traceFile}: ${err.message}`);
    }
  }
  return traces;
}

/**
 * Scan each eval species for species.json + extract scoring weights.
 * Phase 43: emits one row per (project, species). Use scanEvalParents() for
 * project-level metadata (project.json).
 */
function scanEvalProjects() {
  console.log("[2h/4] Scanning eval species metadata (project âŠ‡ species merged)");
  const rows = [];
  for (const sp of listEvalSpecies()) {
    try {
      // Merge-at-read-time (task 42.4-15, decision gad-184). The resolved
      // shape already includes project defaults (techStack, contextFramework,
      // installedSkills, defaultContent, ...) layered underneath the species
      // overrides. Never hand-merge project.json + species.json here.
      const data = loadResolvedSpeciesMerged(sp.projectDir, sp.species);
      const rawFramework = data.contextFramework || data.workflow || sp.species || null;
      const contextFramework =
        rawFramework === "emergent" ? "custom" : rawFramework;
      rows.push({
        // Composite key â€” the new canonical species id
        id: sp.id,
        project: sp.project,
        species: sp.species,
        // Legacy `name` field â€” kept as the species name for backwards-compat
        // with consumers that still index by a single string.
        name: sp.id,
        description: data.description || null,
        workflow: data.workflow || null,
        contextFramework,
        baseline: data.baseline || null,
        constraints: data.constraints || null,
        scoringWeights: data.scoring?.weights || null,
        humanReviewRubric: data.humanReviewRubric || null,
        domain: data.domain || null,
        techStack: data.techStack || null,
        buildRequirement: data.buildRequirement || null,
      });
    } catch (err) {
      console.warn(`  [warn] failed to parse ${sp.speciesJsonPath}: ${err.message}`);
    }
  }
  console.log(`  [scan] ${rows.length} eval species across ${new Set(rows.map(r => r.project)).size} project(s)`);
  return rows;
}

/**
 * Scan each parent eval project's project.json. Returns one row per project.
 */
function scanEvalParents() {
  console.log("[2h.5/4] Scanning eval project metadata (project.json)");
  const rows = [];
  for (const p of listEvalProjects()) {
    rows.push({
      id: p.project,
      project: p.project,
      name: p.meta.name || p.project,
      slug: p.meta.slug || p.project,
      description: p.meta.description || null,
      domain: p.meta.domain || null,
      techStack: p.meta.techStack || null,
      tagline: p.meta.tagline || null,
      cardImage: p.meta.cardImage || null,
      heroImage: p.meta.heroImage || null,
    });
  }
  return rows;
}

/**
 * Scan each eval run's run/ directory for what the agent produced for itself â€”
 * workflow notes, written skills, created AGENTS.md, planning artifacts.
 * Returns a map keyed by `${project}/${version}` -> { skillFiles, agentFiles, planningFiles, workflowNotes }.
 */
function scanProducedArtifacts() {
  console.log("[2i/4] Scanning agent-produced artifacts per generation");
  const produced = {};
  for (const gen of listEvalGenerations()) {
    const runDir = gen.runDir;
    if (!exists(runDir)) continue;
    const key = gen.id;
    {
      const entry = {
        skillFiles: [],
        agentFiles: [],
        planningFiles: [],
        workflowNotes: [],
      };
      // Look for game/.planning/skills/*.md (bare/emergent pattern)
      const candidates = [
        path.join(runDir, "game", ".planning", "skills"),
        path.join(runDir, ".planning", "skills"),
        path.join(runDir, "game", "skills"),
      ];
      for (const skillDir of candidates) {
        if (!exists(skillDir)) continue;
        for (const f of fs.readdirSync(skillDir)) {
          if (f.endsWith(".md")) {
            const fullPath = path.join(skillDir, f);
            const size = fs.statSync(fullPath).size;
            let content = null;
            try {
              // Cap at 64KB to keep the generated TS reasonable
              if (size <= 64 * 1024) {
                content = fs.readFileSync(fullPath, "utf8");
              }
            } catch {}
            const relFile = path.relative(REPO_ROOT, fullPath).replace(/\\/g, "/");
            entry.skillFiles.push({ name: f, bytes: size, content, file: relFile });
          }
        }
      }
      // game/.planning/agents/*.md
      const agentCandidates = [
        path.join(runDir, "game", ".planning", "agents"),
        path.join(runDir, ".planning", "agents"),
      ];
      for (const agentDir of agentCandidates) {
        if (!exists(agentDir)) continue;
        for (const f of fs.readdirSync(agentDir)) {
          if (f.endsWith(".md")) {
            entry.agentFiles.push({ name: f, bytes: fs.statSync(path.join(agentDir, f)).size });
          }
        }
      }
      // game/.planning/*.md (WORKFLOW.md, CHANGELOG.md, ARCHITECTURE.md, NOTES.md etc)
      const planningCandidates = [
        path.join(runDir, "game", ".planning"),
        path.join(runDir, ".planning"),
      ];
      for (const pd of planningCandidates) {
        if (!exists(pd)) continue;
        for (const f of fs.readdirSync(pd)) {
          const fp = path.join(pd, f);
          if (fs.statSync(fp).isFile() && f.endsWith(".md")) {
            entry.planningFiles.push({ name: f, bytes: fs.statSync(fp).size });
          }
        }
      }
      // WORKFLOW.md at run root (bare pattern)
      const workflowMd = path.join(runDir, "WORKFLOW.md");
      if (exists(workflowMd)) {
        entry.workflowNotes.push({ name: "WORKFLOW.md", bytes: fs.statSync(workflowMd).size });
      }
      if (
        entry.skillFiles.length > 0 ||
        entry.agentFiles.length > 0 ||
        entry.planningFiles.length > 0 ||
        entry.workflowNotes.length > 0
      ) {
        produced[key] = entry;
      }
    }
  }
  console.log(`  [scan] ${Object.keys(produced).length} generation(s) with produced artifacts`);
  return produced;
}

const IMPLEMENTATION_WORKFLOWS = new Set(["gad", "bare", "emergent"]);

function inferWorkflow(project, data) {
  // Phase 43: species name is now the canonical context_framework. The
  // helpers pass species through `data.species` when scanning, so prefer
  // that when present.
  if (data.species && IMPLEMENTATION_WORKFLOWS.has(data.species)) return data.species;
  if (data.contextFramework && IMPLEMENTATION_WORKFLOWS.has(data.contextFramework)) return data.contextFramework;
  if (data.workflow && IMPLEMENTATION_WORKFLOWS.has(data.workflow)) return data.workflow;
  return "gad";
}

function isImplementationRun(project, data) {
  // cli-efficiency is a tooling eval with workflow="A"/"B" letters â€” not
  // comparable to implementation eval results.
  if (project.startsWith("cli-efficiency")) return false;
  // Accept implementation + greenfield + brownfield eval types.
  // Only reject explicit non-implementation types like "tooling".
  const validTypes = new Set(["implementation", "greenfield", "brownfield", undefined, null, ""]);
  if (data.eval_type && !validTypes.has(data.eval_type)) return false;
  return true;
}

// -------------------------------------------------------------------------
// Requirements versions â€” the current v4 and a narrative for v1-v3
// -------------------------------------------------------------------------

function copyCurrentRequirements() {
  console.log("[2c/4] Copying current game requirements");
  const out = [];
  ensureDir(REQUIREMENTS_DIR);
  // Phase 43: walk every species under escape-the-dungeon for its current
  // REQUIREMENTS.xml. The single-source-of-truth is at species/<species>/template/.
  for (const sp of listEvalSpecies()) {
    if (sp.project !== "escape-the-dungeon") continue;
    const candidates = [
      path.join(sp.templateDir, ".planning", "REQUIREMENTS.xml"),
      path.join(sp.templateDir, "REQUIREMENTS.xml"),
    ];
    const src = candidates.find(exists);
    if (!src) continue;
    const content = fs.readFileSync(src, "utf8");
    const versionMatch = content.match(/<requirements\s+version="([^"]+)"/);
    const version = versionMatch ? versionMatch[1] : "unknown";
    const slug = `${sp.project}-${sp.species}`;
    const destName = `${slug}-REQUIREMENTS-${version}.xml`;
    const dest = path.join(REQUIREMENTS_DIR, destName);
    fs.copyFileSync(src, dest);
    const size = fs.statSync(dest).size;
    console.log(`  [copy] ${slug} ${version} â†’ ${path.relative(SITE_ROOT, dest)} (${formatBytes(size)})`);
    out.push({
      project: sp.project,
      species: sp.species,
      id: sp.id,
      version,
      path: `/downloads/requirements/${destName}`,
      bytes: size,
      content,
      sourcePath: path.relative(REPO_ROOT, src).replace(/\\/g, "/"),
    });
  }
  // Also copy the REQUIREMENTS-VERSIONS.md narrative so users can download the
  // full history as a single file.
  const historyFile = path.join(EVALS_DIR, "REQUIREMENTS-VERSIONS.md");
  if (exists(historyFile)) {
    const dest = path.join(REQUIREMENTS_DIR, "REQUIREMENTS-VERSIONS.md");
    fs.copyFileSync(historyFile, dest);
    console.log(`  [copy] requirements history narrative â†’ ${path.relative(SITE_ROOT, dest)}`);
  }

  // Extract historical REQUIREMENTS.md snapshots from git. These are the eval
  // DESCRIPTION docs (what the eval measures), not the game spec itself â€” the
  // game spec XML was only committed starting with v4. Still valuable for
  // lineage, labelled truthfully as "eval description snapshots".
  const historicalSnapshots = [
    {
      commit: "b5052fe",
      date: "2026-04-06",
      label: "pre-gates",
      project: "escape-the-dungeon",
      repoPath: "evals/escape-the-dungeon/REQUIREMENTS.md",
    },
    {
      commit: "02b0e84",
      date: "2026-04-07",
      label: "hosted-demo-added",
      project: "escape-the-dungeon",
      repoPath: "evals/escape-the-dungeon/REQUIREMENTS.md",
    },
  ];
  const extracted = [];
  for (const snap of historicalSnapshots) {
    const content = gitShow(snap.commit, snap.repoPath);
    if (!content) {
      console.warn(`  [skip] snapshot ${snap.commit}: not found`);
      continue;
    }
    const destName = `${snap.project}-EVAL-REQUIREMENTS-${snap.date}-${snap.label}.md`;
    const dest = path.join(REQUIREMENTS_DIR, destName);
    // Prepend a short provenance header so the file is self-describing.
    const annotated =
      `<!-- Extracted from git commit ${snap.commit} on ${snap.date} (${snap.label}). -->\n` +
      `<!-- This is the eval DESCRIPTION doc â€” what the eval measures â€” not the\n` +
      `     game spec. The game spec XML lives in template/.planning/REQUIREMENTS.xml\n` +
      `     and was only committed to git starting with v4 (the earlier .planning/\n` +
      `     directories were gitignored). -->\n\n` +
      content;
    fs.writeFileSync(dest, annotated, "utf8");
    const size = fs.statSync(dest).size;
    console.log(`  [git] snapshot ${snap.commit} (${snap.date}) â†’ ${path.relative(SITE_ROOT, dest)} (${formatBytes(size)})`);
    extracted.push({
      commit: snap.commit,
      date: snap.date,
      label: snap.label,
      project: snap.project,
      path: `/downloads/requirements/${destName}`,
      bytes: size,
    });
  }
  out.push(...extracted.map((e) => ({
    project: e.project,
    version: `snapshot-${e.date}`,
    path: e.path,
    bytes: e.bytes,
    label: e.label,
    commit: e.commit,
    isSnapshot: true,
  })));
  return out;
}

function parseRequirementsHistory() {
  console.log("[2d/4] Parsing REQUIREMENTS-VERSIONS.md");
  const file = path.join(EVALS_DIR, "REQUIREMENTS-VERSIONS.md");
  if (!exists(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  // Split on ## vN headers.
  const chunks = text.split(/^## /m).slice(1); // first is header
  const versions = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const header = lines[0] ?? "";
    const versionMatch = header.match(/^(v\d+)\s*â€”\s*(\d{4}-\d{2}-\d{2})/);
    if (!versionMatch) continue;
    const body = lines.slice(1).join("\n").trim();
    // Extract labeled sections by bold prefix.
    const sections = {};
    const sectionRegex = /\*\*([^:*]+):\*\*([\s\S]*?)(?=\n\*\*[^:*]+:\*\*|$)/g;
    let match;
    while ((match = sectionRegex.exec(body)) !== null) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
      sections[key] = match[2].trim();
    }
    versions.push({
      version: versionMatch[1],
      date: versionMatch[2],
      rawBody: body,
      sections,
    });
  }
  console.log(`  [parse] ${versions.length} requirements versions`);
  return versions;
}

// -------------------------------------------------------------------------
// Catalog scanners - skills, agents, templates
// -------------------------------------------------------------------------

function scanDirFiles(dir, pattern) {
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && pattern.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    } else if (entry.isDirectory()) {
      const nested = path.join(dir, entry.name, "SKILL.md");
      if (exists(nested)) out.push(nested);
    }
  }
  return out.sort();
}

function scanCatalog() {
  console.log("[2e/4] Scanning catalog (skills, agents, templates)");
  const catalog = { skills: [], agents: [], commands: [], templates: [] };
  function shouldSkipCatalogSkill(baseDir, entryName) {
    if (entryName.startsWith("gad-")) return false;
    const gadSibling = path.join(baseDir, `gad-${entryName}`, "SKILL.md");
    return exists(gadSibling);
  }

  function addSkillsFromDir(baseDir, sourceLabel, defaultOrigin = "human-authored") {
    if (!exists(baseDir)) return;
    function readSkill(skillDir, id, origin, fileBase) {
      const file = path.join(skillDir, "SKILL.md");
      if (!exists(file)) return null;
      const src = fs.readFileSync(file, "utf8");
      const { data, body } = parseFrontmatter(src);
      const declaredOrigin = data.origin || origin;
      const iconPath = path.join(SITE_ROOT, "public", "skills", `${id}.png`);
      const imagePath = exists(iconPath) ? `/skills/${id}.png` : null;
      return {
        id,
        name: data.name || id,
        description: data.description || firstParagraph(body, 280),
        imagePath,
        origin: declaredOrigin,
        authoredBy: data["authored-by"] || null,
        authoredOn: data["authored-on"] || null,
        excludedFromDefaultInstall: data["excluded-from-default-install"] === true || declaredOrigin === "emergent",
        frameworkSkill: data["framework_skill"] === true || data["framework-skill"] === true,
        file: `${fileBase}/${id}/SKILL.md`,
        source: sourceLabel,
        bodyHtml: renderMarkdown(body),
        bodyRaw: body,
      };
    }

    const emergentDir = path.join(baseDir, "emergent");
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "emergent") continue; // handled separately
      if (entry.name === "candidates") continue; // quarantined drafts (GAD-D-144), excluded from catalog
      if (entry.name === "proto-skills") continue; // incubation stage, not part of the public/runtime catalog
      if (shouldSkipCatalogSkill(baseDir, entry.name)) continue; // legacy alias superseded by gad-* canonical skill
      const skill = readSkill(
        path.join(baseDir, entry.name),
        entry.name,
        defaultOrigin,
        "vendor/get-anything-done/skills"
      );
      if (skill) catalog.skills.push(skill);
    }

    if (exists(emergentDir)) {
      for (const entry of fs.readdirSync(emergentDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (!entry.isDirectory()) continue;
        const skill = readSkill(
          path.join(emergentDir, entry.name),
          entry.name,
          "emergent",
          "vendor/get-anything-done/skills/emergent"
        );
        if (skill) catalog.skills.push(skill);
      }
    }
  }

  addSkillsFromDir(SKILLS_DIR, "framework", "official");
  const emergentCount = catalog.skills.filter((s) => s.origin === "emergent").length;
  console.log(`  [skills] ${catalog.skills.length} total (${emergentCount} emergent, excluded from default install)`);

  if (exists(AGENTS_DIR)) {
    for (const name of fs.readdirSync(AGENTS_DIR).sort()) {
      if (!name.endsWith(".md")) continue;
      const file = path.join(AGENTS_DIR, name);
      const src = fs.readFileSync(file, "utf8");
      const { data, body } = parseFrontmatter(src);
      const id = name.replace(/\.md$/, "");
      catalog.agents.push({
        id,
        name: data.name || id,
        description: data.description || firstParagraph(body, 280),
        tools: normalizeAgentToolsField(data.tools),
        color: data.color || null,
        file: `vendor/get-anything-done/agents/${name}`,
        bodyHtml: renderMarkdown(body),
        bodyRaw: body,
      });
    }
  }

  if (exists(TEMPLATES_DIR)) {
    function walk(dir, rel = "") {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const sp = path.join(dir, entry.name);
        const r = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(sp, r);
        else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".toml") || entry.name.endsWith(".json"))) {
          const size = fs.statSync(sp).size;
          catalog.templates.push({ path: r, bytes: size });
        }
      }
    }
    walk(TEMPLATES_DIR);
  }

  // Scan which eval templates inherit which framework skills.
  // template/skills/<name>.md â†’ the eval copies that skill into its starting state.
  const inheritanceMap = {}; // skillId -> [project...]
  for (const skill of catalog.skills) inheritanceMap[skill.id] = [];
  for (const sp of listEvalSpecies()) {
    const skillsDir = path.join(sp.templateDir, "skills");
    if (!exists(skillsDir)) continue;
    for (const file of fs.readdirSync(skillsDir)) {
      if (!file.endsWith(".md")) continue;
      const skillId = file.replace(/\.md$/, "");
      if (inheritanceMap[skillId]) inheritanceMap[skillId].push(sp.id);
    }
  }
  catalog.inheritance = inheritanceMap;

  catalog.workflows = parseWorkflows();
  catalog.humanWorkflows = parseHumanWorkflows();
  catalog.contextFrameworks = parseContextFrameworks();
  // Live/emergent synthesis reads trace events and enriches workflow entries
  // in place. Authored workflows gain `liveGraph` and `conformance`; emergent
  // workflows are appended to the same array with `origin: "emergent"`.
  // Load the gad-framework-scoped trace events ONCE here so multiple
  // downstream synthesizers (workflow trace + signal analytics, task 44-21)
  // share the same array.
  const traceEvents = loadTraceEvents({ scope: "gad-framework" });
  synthesizeWorkflowTraceData(catalog.workflows, traceEvents);
  catalog.signal = synthesizeSignalAnalytics(traceEvents);

  console.log(
    `  [scan] skills=${catalog.skills.length} agents=${catalog.agents.length} templates=${catalog.templates.length} workflows=${catalog.workflows.length}`
  );
  const inheritedCount = Object.values(inheritanceMap).filter((v) => v.length > 0).length;
  console.log(`  [scan] ${inheritedCount} skill(s) inherited by at least one eval template`);
  return catalog;
}

// -------------------------------------------------------------------------
// Workflows â€” parse hand-authored .planning/workflows/*.md files into
// a typed WORKFLOWS catalog. Each file has YAML frontmatter + exactly one
// mermaid fenced block per .planning/workflows/README.md schema.
// -------------------------------------------------------------------------

function parseWorkflows() {
  const out = [];
  if (!exists(WORKFLOWS_DIR)) return out;
  for (const name of fs.readdirSync(WORKFLOWS_DIR).sort()) {
    if (!name.endsWith(".md")) continue;
    if (name === "README.md") continue;
    const file = path.join(WORKFLOWS_DIR, name);
    const fullSrc = fs.readFileSync(file, "utf8");
    const { data: meta, body: src } = parseFrontmatter(fullSrc);
    const slug = meta.slug || name.replace(/\.md$/, "");

    // Extract the (single) mermaid fenced block.
    const mermaidMatch = src.match(/```mermaid\n([\s\S]*?)```/);
    const mermaidBody = mermaidMatch ? mermaidMatch[1].trim() : "";
    if (!mermaidBody) {
      console.warn(`  [workflows] ${name} has no mermaid block â€” skipping`);
      continue;
    }

    const participants = meta.participants || {};
    const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [String(v)]);

    out.push({
      slug,
      name: meta.name || slug,
      description: meta.description || "",
      trigger: meta.trigger || "",
      participants: {
        skills: asArray(participants.skills),
        agents: asArray(participants.agents),
        cli: asArray(participants.cli),
        artifacts: asArray(participants.artifacts),
      },
      parentWorkflow: meta["parent-workflow"] || meta.parentWorkflow || null,
      relatedPhases: asArray(meta["related-phases"] || meta.relatedPhases).map(String),
      origin: meta.origin === "emergent" ? "emergent" : "authored",
      mermaidBody,
      bodyHtml: renderMarkdown(src),
      file: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
    });
  }
  console.log(`  [workflows] parsed ${out.length} workflow(s) from ${path.relative(REPO_ROOT, WORKFLOWS_DIR)}`);
  return out;
}

// -------------------------------------------------------------------------
// Human workflows â€” hand-authored operator routines. Distinct from
// .planning/workflows/ (agent workflows): no trace matching, no
// conformance score, Mermaid is optional, frontmatter shape is different.
// Decision / task 44-22.
// -------------------------------------------------------------------------

function parseHumanWorkflows() {
  const out = [];
  if (!exists(HUMAN_WORKFLOWS_DIR)) return out;
  for (const name of fs.readdirSync(HUMAN_WORKFLOWS_DIR).sort()) {
    if (!name.endsWith(".md")) continue;
    if (name === "README.md") continue;
    const file = path.join(HUMAN_WORKFLOWS_DIR, name);
    const fullSrc = fs.readFileSync(file, "utf8");
    const { data: meta, body: src } = parseFrontmatter(fullSrc);
    const slug = meta.slug || name.replace(/\.md$/, "");

    const mermaidMatch = src.match(/```mermaid\n([\s\S]*?)```/);
    const mermaidBody = mermaidMatch ? mermaidMatch[1].trim() : "";

    const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [String(v)]);

    out.push({
      slug,
      name: meta.name || slug,
      operator: meta.operator || "human",
      frequency: meta.frequency || "",
      triggers: asArray(meta.triggers).map(String),
      projectsTouched: asArray(meta["projects-touched"] || meta.projectsTouched).map(String),
      relatedPhases: asArray(meta["related-phases"] || meta.relatedPhases).map(String),
      mermaidBody,
      bodyHtml: renderMarkdown(src),
      bodyRaw: src,
      file: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
    });
  }
  console.log(
    `  [human-workflows] parsed ${out.length} human workflow(s) from ${path.relative(REPO_ROOT, HUMAN_WORKFLOWS_DIR)}`
  );
  return out;
}

/**
 * Context frameworks (phase 42.4, decision gad-179) are bundles that
 * reference existing catalog items by slug. Each lives as a Markdown file
 * under .planning/context-frameworks/*.md with YAML frontmatter listing
 * the skills/agents/workflows it includes.
 */
function parseContextFrameworks() {
  const out = [];
  if (!exists(CONTEXT_FRAMEWORKS_DIR)) return out;
  for (const name of fs.readdirSync(CONTEXT_FRAMEWORKS_DIR).sort()) {
    if (!name.endsWith(".md")) continue;
    if (name === "README.md") continue;
    const file = path.join(CONTEXT_FRAMEWORKS_DIR, name);
    const fullSrc = fs.readFileSync(file, "utf8");
    const { data: meta, body: src } = parseFrontmatter(fullSrc);
    const slug = meta.slug || name.replace(/\.md$/, "");
    const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [String(v)]);
    out.push({
      slug,
      name: meta.name || slug,
      description: meta.description || "",
      version: meta.version ? String(meta.version) : "0.0.0",
      extends: meta.extends && meta.extends !== "null" ? String(meta.extends) : null,
      skills: asArray(meta.skills).map(String),
      agents: asArray(meta.agents).map(String),
      workflows: asArray(meta.workflows).map(String),
      canonicalProjects: asArray(meta.canonicalProjects || meta["canonical-projects"]).map(String),
      bodyHtml: renderMarkdown(src),
      bodyRaw: src,
      file: path.relative(REPO_ROOT, file).replace(/\\/g, "/"),
    });
  }
  console.log(`  [context-frameworks] parsed ${out.length} framework(s) from ${path.relative(REPO_ROOT, CONTEXT_FRAMEWORKS_DIR)}`);
  return out;
}

// -------------------------------------------------------------------------
// Workflow trace synthesis (phase 42.3-04 + 42.3-09)
// Reads `.planning/.trace-events.jsonl`, derives:
//   1. An "actual graph" per authored workflow by matching expected
//      participants against real tool_use/file_mutation events.
//   2. A `workflow_conformance` score per authored workflow.
//   3. Emergent workflow candidates via a simple DFG + n-gram frequency
//      mine over tool_use sequences.
// v1 is deterministic, pure Node, no dependencies â€” decision gad-174.
// -------------------------------------------------------------------------

const TRACE_EVENTS_PATH = path.join(REPO_ROOT, ".planning", ".trace-events.jsonl");

const WORKFLOW_MINE_THRESHOLDS = {
  min_support: 3,
  min_length: 3,
  max_length: 5,
  max_emergent: 12,
};

/**
 * Determine an event's "scope" â€” which context it belongs to. v1 uses a
 * path-based heuristic: anything inside a worktree directory or eval
 * preservation path is classified as `eval-agent` (work an agent did inside
 * an eval project), everything else is `gad-framework` (real work on the
 * GAD framework itself). Decision gad-175 â€” v2 will move this to an
 * explicit scope tag written by the hooks, but the filter is still
 * applied here so legacy traces can be analyzed.
 */
function classifyTraceEventScope(evt) {
  // Prefer the explicit scope written by gad-trace-hook.cjs at emission
  // time (decision gad-175 v2). Fall back to the path-based heuristic
  // for legacy events written before the hook was updated.
  if (evt && typeof evt.scope === "string" && evt.scope.length > 0) {
    return evt.scope;
  }
  const touched =
    evt?.type === "file_mutation"
      ? evt.path
      : evt?.type === "tool_use" && evt.inputs && (evt.inputs.file_path || evt.inputs.command || evt.inputs.notebook_path)
        ? evt.inputs.file_path || evt.inputs.command || evt.inputs.notebook_path
        : null;
  const hay = String(touched || "").replace(/\\/g, "/").toLowerCase();
  if (!hay) return "gad-framework";
  if (hay.includes(".claude/worktrees/") || hay.includes("/worktrees/agent-") || hay.includes("/worktrees/")) return "eval-agent";
  if (hay.includes("/evals/") && hay.includes("/game/")) return "eval-agent";
  return "gad-framework";
}

function loadTraceEvents({ scope } = {}) {
  if (!exists(TRACE_EVENTS_PATH)) return [];
  const raw = fs.readFileSync(TRACE_EVENTS_PATH, "utf8").split(/\r?\n/).filter(Boolean);
  const out = [];
  for (const line of raw) {
    try {
      const evt = JSON.parse(line);
      if (scope && classifyTraceEventScope(evt) !== scope) continue;
      out.push(evt);
    } catch {
      // skip malformed lines
    }
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a matcher set from an authored workflow's participants.
 * CLI entries become regex prefixes; artifacts become substring checks
 * (with <slug> wildcards stripped); agent/skill entries match trigger_skill
 * and agent identity when present in the trace.
 */
function buildParticipantMatchers(workflow) {
  const cli = (workflow.participants.cli || []).map((c) => ({
    kind: "cli",
    label: c,
    regex: new RegExp("^\\s*" + escapeRegExp(c.trim().split(/\s+/)[0]) + "\\b", "i"),
    prefix: c.trim(),
  }));
  const artifacts = (workflow.participants.artifacts || []).map((a) => ({
    kind: "artifact",
    label: a,
    needle: a.replace(/<[^>]+>/g, "").replace(/\\/g, "/").toLowerCase(),
  }));
  const skills = (workflow.participants.skills || []).map((s) => ({ kind: "skill", label: s }));
  const agents = (workflow.participants.agents || []).map((a) => ({ kind: "agent", label: a }));
  return { cli, artifacts, skills, agents };
}

function matchEventToParticipant(evt, matchers) {
  if (evt.type === "tool_use" && evt.tool === "Bash") {
    const cmd = (evt.inputs && evt.inputs.command) || "";
    for (const m of matchers.cli) {
      if (m.regex.test(cmd) && cmd.toLowerCase().includes(m.prefix.toLowerCase())) {
        return { kind: "cli", label: m.label };
      }
    }
  }

  const touched =
    evt.type === "file_mutation"
      ? evt.path
      : evt.type === "tool_use" && evt.inputs && (evt.inputs.file_path || evt.inputs.notebook_path)
        ? evt.inputs.file_path || evt.inputs.notebook_path
        : null;

  if (touched) {
    const haystack = String(touched).replace(/\\/g, "/").toLowerCase();
    for (const m of matchers.artifacts) {
      if (!m.needle) continue;
      if (haystack.includes(m.needle)) return { kind: "artifact", label: m.label };
    }
  }

  if (evt.trigger_skill) {
    for (const m of matchers.skills) {
      if (m.label.toLowerCase() === String(evt.trigger_skill).toLowerCase()) {
        return { kind: "skill", label: m.label };
      }
    }
  }

  return null;
}

/**
 * Collapse a sequence of matched nodes into a directed graph.
 * Consecutive duplicates collapse to a single node with an incremented count;
 * temporal adjacency becomes edges. Returns React-Flow-shaped nodes/edges.
 */
function sequenceToGraph(sequence, workflowSlug) {
  if (sequence.length === 0) return { nodes: [], edges: [] };

  const collapsed = [];
  for (const step of sequence) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.label === step.label && last.kind === step.kind) {
      last.count = (last.count ?? 1) + 1;
    } else {
      collapsed.push({ ...step, count: 1 });
    }
  }

  const nodes = collapsed.map((step, i) => ({
    id: `${workflowSlug}-n${i}`,
    type: "live",
    position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 },
    data: { label: step.label, kind: step.kind, count: step.count },
  }));

  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `${workflowSlug}-e${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      animated: false,
    });
  }

  return { nodes, edges };
}

/**
 * workflow_conformance v1 formula per decision gad-173:
 *   (matching_nodes âˆ’ extra_nodes âˆ’ out_of_order_nodes) / expected_nodes
 * For v1 we approximate by counting how many authored participants were
 * observed at least once (matching) and how many unique observed nodes had
 * no authored counterpart (extra). Out-of-order tracking is deferred until
 * explicit workflow_enter/workflow_exit events land in the trace schema.
 */
function computeConformance(workflow, observedNodes) {
  const expected = new Set();
  for (const c of workflow.participants.cli || []) expected.add(`cli:${c}`);
  for (const a of workflow.participants.artifacts || []) expected.add(`artifact:${a}`);
  for (const s of workflow.participants.skills || []) expected.add(`skill:${s}`);
  const expectedCount = expected.size || 1;

  const observedKeys = new Set();
  for (const n of observedNodes) observedKeys.add(`${n.data.kind}:${n.data.label}`);

  let matched = 0;
  let extra = 0;
  for (const key of observedKeys) {
    if (expected.has(key)) matched += 1;
    else extra += 1;
  }

  const score = Math.max(0, matched - extra) / expectedCount;
  return {
    score: Math.round(score * 1000) / 1000,
    matched,
    extra,
    out_of_order: 0,
    expected: expectedCount,
  };
}

/**
 * DFG + frequent n-gram detector.
 *
 * v2 target (decision gad-178): mine SKILL invocation sequences via
 * `trigger_skill` tags that CLI-aware skills stamp through
 * `gad --skill <slug>`. Skill-level patterns are the real signal.
 *
 * v1 fallback: if no events carry a `trigger_skill` yet, fall back to
 * mining raw tool names. Tool-level candidates are clearly labeled as
 * v1 so the UI can badge them differently from real skill patterns.
 */
function detectEmergentWorkflows(events, authoredWorkflows) {
  const taggedEvents = events.filter((e) => e && e.type === "tool_use" && e.trigger_skill);
  const useSkillStream = taggedEvents.length >= WORKFLOW_MINE_THRESHOLDS.min_length;

  const sourceLabel = useSkillStream ? "skill-level (v2)" : "tool-level (v1 fallback)";
  console.log(
    `  [workflow-trace] emergent source: ${sourceLabel} â€” ${useSkillStream ? taggedEvents.length + " tagged events" : "no trigger_skill tags yet, mining raw tool names"}`
  );

  const sequence = useSkillStream
    ? taggedEvents.map((e) => e.trigger_skill)
    : events.filter((e) => e && e.type === "tool_use" && e.tool).map((e) => e.tool);

  if (sequence.length < WORKFLOW_MINE_THRESHOLDS.min_length) return [];

  const counts = new Map();
  for (let len = WORKFLOW_MINE_THRESHOLDS.min_length; len <= WORKFLOW_MINE_THRESHOLDS.max_length; len++) {
    for (let i = 0; i <= sequence.length - len; i++) {
      const key = sequence.slice(i, i + len).join("â†’");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // Filter to support threshold, rank by (length * support) for interest.
  const raw = [];
  for (const [key, count] of counts.entries()) {
    if (count < WORKFLOW_MINE_THRESHOLDS.min_support) continue;
    const labels = key.split("â†’");
    raw.push({ key, labels, support: count, score: labels.length * count });
  }
  raw.sort((a, b) => b.score - a.score);

  // Suppress tuples that are prefixes of longer tuples with equal support.
  const picked = [];
  for (const cand of raw) {
    const dominated = picked.some(
      (p) =>
        p.support === cand.support &&
        p.labels.length > cand.labels.length &&
        p.key.startsWith(cand.key)
    );
    if (!dominated) picked.push(cand);
    if (picked.length >= WORKFLOW_MINE_THRESHOLDS.max_emergent) break;
  }

  // Ground-truth filter: drop candidates that are substrings of any authored
  // workflow participant set (i.e. not genuinely emergent, just re-derived).
  const authoredSignatures = new Set();
  for (const w of authoredWorkflows) {
    authoredSignatures.add((w.participants.cli || []).join("â†’"));
  }

  return picked
    .filter((p) => !authoredSignatures.has(p.key))
    .map((p, idx) => {
      const slug = `emergent-${p.labels.map((l) => l.toLowerCase()).join("-")}-${p.support}-${idx}`;
      const nodes = p.labels.map((label, i) => ({
        id: `${slug}-n${i}`,
        type: "live",
        position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 },
        data: { label, kind: "skill", count: p.support },
      }));
      const edges = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({ id: `${slug}-e${i}`, source: nodes[i].id, target: nodes[i + 1].id });
      }
      // Decision gad-177: emergent workflows have NO authored mermaid body.
      // They have no designed shape â€” the React Flow live graph IS the
      // emergent workflow. mermaidBody stays empty so WorkflowCard knows
      // to render a single-column (React-Flow-only) layout.
      const detectorLabel = useSkillStream ? "skill-level (v2)" : "tool-level (v1)";
      const descriptionPrefix = useSkillStream
        ? `Recurring skill invocation sequence detected ${p.support}Ã— in trace data (detector v2 â€” skill-level).`
        : `Recurring tool-use sequence detected ${p.support}Ã— in trace data (detector v1 â€” tool-level fallback; will be replaced once skills start tagging via \`gad --skill\`).`;
      return {
        slug,
        name: `${p.labels.join(" â†’ ")}`,
        description: `${descriptionPrefix} Not hand-authored â€” the live graph IS the workflow shape. Promote to an authored workflow via \`gad workflow promote ${slug}\` or discard.`,
        detector: detectorLabel,
        trigger: `Detected automatically from .planning/.trace-events.jsonl by the frequent-subgraph detector (phase 42.3-09).`,
        participants: {
          skills: [],
          agents: [],
          cli: [],
          artifacts: [],
        },
        parentWorkflow: null,
        relatedPhases: ["42.3"],
        origin: "emergent",
        mermaidBody: "",
        bodyHtml: `<p>Recurring tool sequence detected <strong>${p.support}Ã—</strong>: ${p.labels.join(" â†’ ")}.</p>`,
        file: ".planning/workflows/emergent/ (generated)",
        liveGraph: { nodes, edges },
        conformance: undefined,
        support: { phases: p.support, stability: 1 },
      };
    });
}

function synthesizeWorkflowTraceData(workflows, preloadedEvents) {
  // Decision gad-175: only consume gad-framework-scoped events when mining
  // GAD's own workflows. Eval-agent events stay with their own eval/generation.
  const events = preloadedEvents != null ? preloadedEvents : loadTraceEvents({ scope: "gad-framework" });
  const totalRaw = loadTraceEvents().length;
  if (events.length === 0) {
    console.log(
      `  [workflow-trace] no gad-framework events (${totalRaw} total; rest are eval-agent scoped) â€” skipping synthesis`
    );
    return;
  }
  console.log(
    `  [workflow-trace] loaded ${events.length} gad-framework events (of ${totalRaw} total; ${totalRaw - events.length} filtered as eval-agent)`
  );

  const authored = workflows.filter((w) => w.origin === "authored");
  let matchedCount = 0;
  for (const workflow of authored) {
    const matchers = buildParticipantMatchers(workflow);
    const matched = [];
    for (const evt of events) {
      const hit = matchEventToParticipant(evt, matchers);
      if (hit) matched.push(hit);
    }
    if (matched.length === 0) continue;
    matchedCount += 1;
    const graph = sequenceToGraph(matched, workflow.slug);
    workflow.liveGraph = graph;
    workflow.conformance = computeConformance(workflow, graph.nodes);
  }
  console.log(
    `  [workflow-trace] synthesized live graphs for ${matchedCount}/${authored.length} authored workflow(s)`
  );

  const emergent = detectEmergentWorkflows(events, authored);
  for (const e of emergent) workflows.push(e);
  console.log(`  [workflow-trace] detected ${emergent.length} emergent candidate(s)`);
}

// -------------------------------------------------------------------------
// Signal analytics (task 44-21) â€” pure reducers over the gad-framework
// scoped trace event stream. v1 surfaces:
//   1. Top files by tool_use count (Read/Edit/Write/Glob/etc.)
//   2. Top skills by trigger_skill invocation
//   3. Tool mix (count + percentage)
//   4. Agent split (default/main vs subagent + role breakdown)
//
// Deferred to v2 (NOT implemented):
//   - Bash command path extraction (split inputs.command into tokens, find
//     repo-relative file refs, fold into topFiles).
//   - WebFetch URL frequency.
//   - Tool/skill n-gram sequences (reuse the synthesizeWorkflowTraceData
//     pattern â€” frequent-subgraph mining).
//   - Per-session trends (group by runtime.session_id).
// -------------------------------------------------------------------------

const SIGNAL_PROJECT_ROOT_PREFIX = "C:/Users/benja/Documents/custom_portfolio/";

function normalizeSignalFilePath(raw) {
  if (raw == null) return null;
  let p = String(raw).replace(/\\/g, "/");
  if (!p) return null;
  // Strip the absolute monorepo root if present (case-insensitive on Win).
  const lowerPrefix = SIGNAL_PROJECT_ROOT_PREFIX.toLowerCase();
  if (p.toLowerCase().startsWith(lowerPrefix)) {
    p = p.slice(SIGNAL_PROJECT_ROOT_PREFIX.length);
  }
  // If still absolute (different drive, /tmp, etc.), drop it â€” we only
  // want repo-relative paths in the leaderboard.
  if (/^[a-zA-Z]:\//.test(p) || p.startsWith("/")) return null;
  return p;
}

function synthesizeSignalAnalytics(events) {
  const safeEvents = Array.isArray(events) ? events : [];
  const toolUse = safeEvents.filter((e) => e && e.type === "tool_use" && e.tool);

  // 1. Top files
  const fileCounts = new Map();
  for (const evt of toolUse) {
    const inputs = evt.inputs || {};
    const raw = inputs.file_path || inputs.notebook_path || null;
    const norm = normalizeSignalFilePath(raw);
    if (!norm) continue;
    fileCounts.set(norm, (fileCounts.get(norm) ?? 0) + 1);
  }
  const topFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([p, count]) => ({ path: p, count }));

  // 2. Top skills
  const skillCounts = new Map();
  for (const evt of toolUse) {
    const skill = evt.trigger_skill;
    if (!skill) continue;
    skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
  }
  const topSkills = [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([skill, count]) => ({ skill, count }));

  // 3. Tool mix
  const toolCounts = new Map();
  for (const evt of toolUse) {
    toolCounts.set(evt.tool, (toolCounts.get(evt.tool) ?? 0) + 1);
  }
  const totalTool = toolUse.length || 1;
  const toolMix = {};
  for (const [tool, count] of toolCounts.entries()) {
    toolMix[tool] = {
      count,
      pct: Math.round((count / totalTool) * 1000) / 10,
    };
  }

  // 4. Agent split â€” default = main session (agent_id null), sub = subagent.
  let defaultCount = 0;
  let subCount = 0;
  const byRole = {};
  for (const evt of toolUse) {
    const agent = evt.agent || {};
    if (agent.agent_id == null) {
      defaultCount += 1;
    } else {
      subCount += 1;
      const role = agent.agent_role || "(unspecified)";
      byRole[role] = (byRole[role] ?? 0) + 1;
    }
  }

  console.log(
    `  [signal] ${toolUse.length} tool_use events â†’ ${topFiles.length} top files, ${topSkills.length} top skills, ${Object.keys(toolMix).length} tools, default=${defaultCount} sub=${subCount}`
  );

  return {
    totalEvents: toolUse.length,
    topFiles,
    topSkills,
    toolMix,
    agentSplit: {
      default: defaultCount,
      sub: subCount,
      byRole,
    },
  };
}

// -------------------------------------------------------------------------
// Planning state â€” parse STATE.xml, TASK-REGISTRY.xml, DECISIONS.xml
// for the /planning meta-transparency page.
// -------------------------------------------------------------------------

function parseAllDecisions() {
  // Uses CLI lib/decisions-reader.cjs via consolidation (gad-126)
  // PROJECT_ROOT respects GAD_PROJECT_ROOT env var (phase 10)
  const root = { id: PROJECT_ID, path: PROJECT_ROOT, planningDir: ".planning" };
  const all = readDecisions(root, "", {});
  // Sort by numeric suffix on gad-NN so the newest appear first.
  all.sort((a, b) => {
    const na = parseInt((a.id.match(/(\d+)/) || [])[1] || "0", 10);
    const nb = parseInt((b.id.match(/(\d+)/) || [])[1] || "0", 10);
    return nb - na;
  });
  console.log(`  [decisions] parsed ${all.length} decision(s) via lib/decisions-reader.cjs`);
  return all;
}

function parseAllPhases() {
  // Uses CLI lib/roadmap-reader.cjs via consolidation (gad-126)
  const root = { id: PROJECT_ID, path: PROJECT_ROOT, planningDir: ".planning" };
  const phases = readPhases(root, "");
  // The CLI reader returns { id, title, goal, status, depends, description }
  // Map to the shape the site expects (add outcome from goal if available)
  const out = phases.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status || "planned",
    goal: p.goal || p.description || "",
    outcome: null,
  }));
  console.log(`  [phases] parsed ${out.length} phase(s) via lib/roadmap-reader.cjs`);
  return out;
}

function parseAllTasks() {
  // Uses CLI lib/task-registry-reader.cjs via consolidation (gad-126)
  const root = { id: PROJECT_ID, path: PROJECT_ROOT, planningDir: ".planning" };
  const tasks = readTasks(root, "", {});
  // Map to the shape the site expects
  const out = tasks.map((t) => ({
    id: t.id,
    phaseId: t.phase,
    status: t.status,
    agentId: t.agentId || null,
    skill: t.skill || null,
    type: t.type || null,
    goal: t.goal,
    keywords: t.keywords ? t.keywords.split(",").map((s) => s.trim()).filter(Boolean) : [],
    depends: t.depends ? t.depends.split(",").map((s) => s.trim()).filter(Boolean) : [],
  }));
  console.log(`  [tasks] parsed ${out.length} task(s) via lib/task-registry-reader.cjs`);
  return out;
}

function writeAgentIngestFiles({ catalog, allDecisions, allTasks, allPhases, pseudoDb, currentRequirements, searchIndex }) {
  // Task 22-39: agent-crawlable documentation export.
  // Writes three artifacts so external agents evaluating GAD can ingest the
  // full system without crawling the HTML:
  //
  //   public/llms.txt            â€” concise index following the emerging
  //                                llms.txt convention (https://llmstxt.org/)
  //                                listing the key pages with one-line notes.
  //   public/llms-full.txt       â€” full-text markdown dump of every skill,
  //                                decision, question, bug, glossary term,
  //                                task, phase, and current requirements XML.
  //   public/api/docs.json       â€” structured JSON of everything above plus
  //                                the search index, so other agents can
  //                                parse it as structured data.
  console.log("[2j/4] Writing agent-crawlable docs (llms.txt, llms-full.txt, api/docs.json)");

  const PUBLIC = path.join(SITE_ROOT, "public");
  const API_DIR = path.join(PUBLIC, "api");
  ensureDir(API_DIR);

  const SITE_URL = "https://get-anything-done.vercel.app";

  // ---------- llms.txt (concise index) ----------
  const llmsTxt = `# Get Anything Done â€” llms.txt

> A research framework for evaluating and evolving AI coding agents under measurable pressure. Everything in this site is backed by files in the repo at https://github.com/MagicbornStudios/get-anything-done. This file follows the llmstxt.org convention.

## Core thesis

- [Home](${SITE_URL}/): Evaluate and evolve agents under measurable pressure
- [Glossary](${SITE_URL}/glossary): Every domain term (CSH, freedom hypothesis, pressure, etc.)
- [Hypotheses](${SITE_URL}/hypotheses): Active hypothesis tracks, evidence status, and caveats
- [Lineage](${SITE_URL}/lineage): GSD â†’ RepoPlanner â†’ GAD

## Evaluation

- [Findings](${SITE_URL}/findings): Per-round writeups
- [Rubric](${SITE_URL}/rubric): Per-project scoring dimensions
- [Questions](${SITE_URL}/questions): Open research questions
- [Data provenance](${SITE_URL}/data): Where every number on the site comes from

## Catalog

- [Skills](${SITE_URL}/skills): ${catalog.skills.length} skills (some are emergent, agent-authored, excluded from default install)
- [Requirements](${SITE_URL}/requirements): Every species' current REQUIREMENTS.xml
- [Playable archive](${SITE_URL}/#play): Every scored build playable in-browser

## System

- [Contribute](${SITE_URL}/contribute): Human-first workflow (clone â†’ install â†’ open in Claude â†’ talk)
- [Planning (moved)](${SITE_URL}/planning): Landing route is a deprecation stub since phase 59. Live planning dashboard — tasks (${allTasks.length}), phases (${allPhases.length}), decisions (${allDecisions.length}), roadmap, requirements, bugs (${(pseudoDb.bugs?.bugs ?? []).length}) — lives on the local planning-app (\`gad planning serve\` → http://localhost:3002/planning).

## Machine-readable

- [llms-full.txt](${SITE_URL}/llms-full.txt): Full text dump of skills, decisions, questions, bugs, glossary, requirements
- [api/docs.json](${SITE_URL}/api/docs.json): Structured JSON with everything above plus the search index

## Canonical repository

${SITE_URL.replace(/\/$/, "")} is a view. The source of truth is the git repository. Clone it:

\`\`\`
git clone https://github.com/MagicbornStudios/get-anything-done
\`\`\`
`;
  fs.writeFileSync(path.join(PUBLIC, "llms.txt"), llmsTxt, "utf8");

  // ---------- llms-full.txt (full content dump) ----------
  const sections = [];

  sections.push(`# Get Anything Done â€” full text export

This file is a concatenation of every agent-ingestable artifact on the site, for consumption by LLMs evaluating or reviewing the GAD framework. Generated at prebuild from source files in the repo. See llms.txt for the index.

Generated: ${new Date().toISOString()}
`);

  // Skills
  sections.push(`\n\n---\n\n# Skills (${catalog.skills.length})\n`);
  for (const s of catalog.skills) {
    sections.push(`\n## ${s.name}${s.origin === "emergent" ? " (emergent)" : ""}\n`);
    sections.push(`id: ${s.id}\n`);
    sections.push(`description: ${s.description}\n`);
    if (s.origin) sections.push(`origin: ${s.origin}\n`);
    if (s.authoredOn) sections.push(`authored: ${s.authoredOn}\n`);
    sections.push(`\n${s.bodyRaw}\n`);
  }

  // Decisions
  sections.push(`\n\n---\n\n# Decisions (${allDecisions.length})\n`);
  for (const d of allDecisions) {
    sections.push(`\n## ${d.id}: ${d.title}\n\n`);
    sections.push(`### Summary\n\n${d.summary}\n\n`);
    if (d.impact) sections.push(`### Impact\n\n${d.impact}\n`);
  }

  // Open questions
  const questions = pseudoDb.openQuestions?.questions ?? [];
  sections.push(`\n\n---\n\n# Open research questions (${questions.length})\n`);
  for (const q of questions) {
    sections.push(`\n## ${q.id}\n\n`);
    sections.push(`**${q.title}**\n\n`);
    sections.push(`Status: ${q.status} | Priority: ${q.priority} | Category: ${q.category}\n\n`);
    sections.push(`${q.context}\n`);
    if (q.resolution) sections.push(`\n**Resolution:** ${q.resolution}\n`);
  }

  // Bugs
  const bugs = pseudoDb.bugs?.bugs ?? [];
  sections.push(`\n\n---\n\n# Observed bugs (${bugs.length})\n`);
  for (const b of bugs) {
    sections.push(`\n## ${b.id}\n\n`);
    sections.push(`**${b.title}** â€” ${b.project}/${b.version} â€” ${b.severity} â€” ${b.status}\n\n`);
    sections.push(`${b.description}\n\n**Expected:** ${b.expected}\n\n**Reproduction:** ${b.reproduction}\n`);
  }

  // Glossary
  const glossary = pseudoDb.glossary?.terms ?? [];
  sections.push(`\n\n---\n\n# Glossary (${glossary.length})\n`);
  for (const g of glossary) {
    sections.push(`\n## ${g.term} (${g.id})\n\n`);
    if (g.aliases?.length) sections.push(`Aliases: ${g.aliases.join(", ")}\n\n`);
    sections.push(`${g.short}\n\n${g.full}\n`);
  }

  // Tasks (summary only â€” 140 full goals would blow up the file)
  sections.push(`\n\n---\n\n# Tasks (${allTasks.length})\n`);
  for (const t of allTasks) {
    sections.push(`\n- **${t.id}** [${t.status}]: ${t.goal.slice(0, 400)}\n`);
  }

  // Phases
  sections.push(`\n\n---\n\n# Phases (${allPhases.length})\n`);
  for (const p of allPhases) {
    sections.push(`\n## Phase ${p.id}: ${p.title}\n\nStatus: ${p.status}\n\n${p.goal}\n`);
  }

  // Current requirements (condensed)
  sections.push(`\n\n---\n\n# Current requirements\n`);
  for (const req of currentRequirements) {
    if (!req.content) continue;
    sections.push(`\n## ${req.project} ${req.version}\n\n`);
    sections.push(`Source: ${req.sourcePath}\n\n`);
    sections.push("```xml\n");
    sections.push(req.content);
    sections.push("\n```\n");
  }

  const llmsFullTxt = sections.join("");
  fs.writeFileSync(path.join(PUBLIC, "llms-full.txt"), llmsFullTxt, "utf8");

  // ---------- api/docs.json (structured) ----------
  const docsJson = {
    meta: {
      site: SITE_URL,
      repo: "https://github.com/MagicbornStudios/get-anything-done",
      generated: new Date().toISOString(),
      schema: "gad-docs-v1",
      description: "Structured machine-readable export of every agent-ingestable artifact on the GAD site. Fetch this if you are an AI agent evaluating or reviewing the GAD framework.",
    },
    skills: catalog.skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      origin: s.origin ?? "human-authored",
      authoredBy: s.authoredBy ?? null,
      authoredOn: s.authoredOn ?? null,
      excludedFromDefaultInstall: !!s.excludedFromDefaultInstall,
      bodyRaw: s.bodyRaw,
      file: s.file,
    })),
    decisions: allDecisions,
    questions,
    bugs,
    glossary,
    tasks: allTasks,
    phases: allPhases,
    requirements: currentRequirements.map((req) => ({
      project: req.project,
      version: req.version,
      sourcePath: req.sourcePath,
      content: req.content,
    })),
    searchIndex: searchIndex,
  };
  fs.writeFileSync(
    path.join(API_DIR, "docs.json"),
    JSON.stringify(docsJson, null, 2),
    "utf8"
  );

  const sizeKb = (p) => (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`  [agent-docs] llms.txt (${sizeKb(path.join(PUBLIC, "llms.txt"))} KB)`);
  console.log(`  [agent-docs] llms-full.txt (${sizeKb(path.join(PUBLIC, "llms-full.txt"))} KB)`);
  console.log(`  [agent-docs] api/docs.json (${sizeKb(path.join(API_DIR, "docs.json"))} KB)`);
}

function computeTaskPressure(xml) {
  // Decision gad-79: task_pressure is computed programmatically from
  // REQUIREMENTS.xml structure. Shannon-entropy intuition without computing
  // entropy directly â€” "pressure â‰ˆ number of decisions/questions required
  // to satisfy the system."
  //
  // Inputs:
  //   R = count of <requirement> elements (inside <gate-criteria> and <addendum>)
  //   G = count of <gate> elements (each gate groups multiple decisions, weighted 2x)
  //   C = count of amends="..." attribute cross-cuts
  //   W = word count as a scope proxy
  //
  // Formula:
  //   raw   = R + 2*G + C
  //   score = log2(raw + 1) / log2(MAX_EXPECTED + 1), clamped [0, 1]
  //
  // MAX_EXPECTED is chosen at 64 so round-5 (Râ‰ˆ21 addendum + G=4 + â‰¥6 cross-cuts
  // â‰ˆ 21 + 8 + 6 = 35 raw) normalizes to log2(36)/log2(65) â‰ˆ 0.86. Values above
  // MAX_EXPECTED clamp to 1.0.
  if (!xml) return { R: 0, G: 0, C: 0, W: 0, raw: 0, score: 0 };

  const reqMatches = xml.match(/<requirement(?:\s[^>]*)?>/g) || [];
  const R = reqMatches.length;

  const gateMatches = xml.match(/<gate\s[^>]*>/g) || [];
  const G = gateMatches.length;

  const amendsMatches = xml.match(/\samends="[^"]+"/g) || [];
  // Each amends attribute may name multiple targets (e.g. amends="G1 G4") â€” count tokens.
  let C = 0;
  for (const m of amendsMatches) {
    const val = m.match(/amends="([^"]+)"/)?.[1] ?? "";
    C += val.split(/\s+/).filter(Boolean).length;
  }

  // Word count over the textual body (strip tags + comments, collapse whitespace)
  const text = xml
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const W = text ? text.split(/\s+/).length : 0;

  const raw = R + 2 * G + C;
  const MAX_EXPECTED = 64;
  const rawScore = Math.log2(raw + 1) / Math.log2(MAX_EXPECTED + 1);
  const score = Math.max(0, Math.min(1, rawScore));

  return { R, G, C, W, raw, score };
}

function computeTaskPressurePerVersion(currentRequirements) {
  // Walk each CurrentRequirementsFile record and compute pressure from its content.
  // Emits a { version: { R, G, C, W, raw, score } } map keyed by requirements version.
  const byVersion = {};
  for (const req of currentRequirements) {
    if (!req.content) continue;
    // Only compute once per version (all three greenfield templates share the same content)
    if (byVersion[req.version]) continue;
    byVersion[req.version] = computeTaskPressure(req.content);
  }
  // For historical versions (v1-v4) that don't have a current template, we parse the
  // version-specific blocks out of REQUIREMENTS-VERSIONS.md narrative instead. But
  // those don't have the same structure, so we leave them with a null-ish entry until
  // the v1-v4 source XMLs are reconstructed or a historical formula is agreed on.
  console.log(`  [pressure] computed task_pressure for ${Object.keys(byVersion).length} version(s):`);
  for (const [v, p] of Object.entries(byVersion)) {
    console.log(
      `    ${v}: R=${p.R} G=${p.G} C=${p.C} W=${p.W} raw=${p.raw} score=${p.score.toFixed(3)}`
    );
  }
  return byVersion;
}

function buildSearchIndex({ decisions, tasks, phases, glossary, questions, bugs, skills, agents, commands }) {
  // Flat list of searchable entries. Each entry is { id, title, kind, href, body }.
  // Body is the searchable haystack â€” fuzzy match against this.
  const entries = [];

  for (const d of decisions) {
    entries.push({
      id: d.id,
      title: d.title,
      kind: "decision",
      href: `/decisions#${d.id}`,
      body: `${d.id} ${d.title} ${d.summary?.slice(0, 400) ?? ""}`,
    });
  }

  for (const t of tasks) {
    entries.push({
      id: t.id,
      title: t.goal.slice(0, 120),
      kind: "task",
      href: `/planning?tab=tasks#${t.id}`,
      body: `${t.id} ${t.goal} ${(t.keywords ?? []).join(" ")}`,
    });
  }

  for (const p of phases) {
    entries.push({
      id: p.id,
      title: `Phase ${p.id} â€” ${p.title}`,
      kind: "phase",
      href: `/planning?tab=phases#${p.id}`,
      body: `${p.id} ${p.title} ${p.goal ?? ""}`,
    });
  }

  for (const g of glossary) {
    entries.push({
      id: g.id,
      title: g.term,
      kind: "glossary",
      href: `/glossary#${g.id}`,
      body: `${g.term} ${(g.aliases ?? []).join(" ")} ${g.short ?? ""}`,
    });
  }

  for (const q of questions) {
    entries.push({
      id: q.id,
      title: q.title,
      kind: "question",
      href: `/questions#${q.id}`,
      body: `${q.title} ${q.context?.slice(0, 400) ?? ""}`,
    });
  }

  for (const b of bugs) {
    entries.push({
      id: b.id,
      title: b.title,
      kind: "bug",
      href: `/planning?tab=bugs#${b.id}`,
      body: `${b.title} ${b.description?.slice(0, 300) ?? ""}`,
    });
  }

  for (const s of skills ?? []) {
    entries.push({
      id: s.id,
      title: s.name ?? s.id,
      kind: "skill",
      href: `/skills/${s.id}`,
      body: `${s.id} ${s.name ?? ""} ${s.description ?? ""}`,
    });
  }

  for (const a of agents ?? []) {
    entries.push({
      id: a.id,
      title: a.name ?? a.id,
      kind: "agent",
      href: `/#catalog`,
      body: `${a.id} ${a.name ?? ""} ${a.description ?? ""}`,
    });
  }

  for (const c of commands ?? []) {
    entries.push({
      id: c.id,
      title: c.name ?? c.id,
      kind: "command",
      href: `/#catalog`,
      body: `${c.id} ${c.name ?? ""} ${c.description ?? ""}`,
    });
  }

  // Lowercase the body once so the client doesn't re-do it on every keystroke.
  const lowered = entries.map((e) => ({ ...e, body: e.body.toLowerCase() }));
  console.log(`  [search] indexed ${lowered.length} entries`);
  return lowered;
}

function parsePlanningState() {
  console.log(`[2g/4] Parsing planning state for ${PROJECT_ID} (STATE, TASKS, DECISIONS)`);
  const planningDir = path.join(PROJECT_ROOT, ".planning");
  const state = {
    currentPhase: null,
    milestone: null,
    nextAction: null,
    lastUpdated: null,
    phases: [],
    openTasks: [],
    doneTasksCount: 0,
    recentDecisions: [],
  };
  if (!exists(planningDir)) {
    console.log("  (no .planning/ directory)");
    return state;
  }

  // STATE.xml
  const statePath = path.join(planningDir, "STATE.xml");
  if (exists(statePath)) {
    const src = fs.readFileSync(statePath, "utf8");
    state.currentPhase = (src.match(/<current-phase>(.*?)<\/current-phase>/) || [])[1] ?? null;
    state.milestone = (src.match(/<milestone>(.*?)<\/milestone>/) || [])[1] ?? null;
    state.lastUpdated = (src.match(/<last-updated>(.*?)<\/last-updated>/) || [])[1] ?? null;
    state.nextAction = (src.match(/<next-action>([\s\S]*?)<\/next-action>/) || [])[1] ?? null;
    if (state.nextAction) state.nextAction = state.nextAction.trim();
  }

  // ROADMAP.xml â€” high-level phase list (uses CLI lib/roadmap-reader.cjs, gad-126)
  const root = { id: PROJECT_ID, path: PROJECT_ROOT, planningDir: ".planning" };
  const phases = readPhases(root, "");
  for (const p of phases) {
    state.phases.push({
      id: p.id,
      title: p.title,
      status: p.status || "planned",
    });
  }

  // TASK-REGISTRY.xml â€” tasks (open vs done)
  const taskPath = path.join(planningDir, "TASK-REGISTRY.xml");
  if (exists(taskPath)) {
    const src = fs.readFileSync(taskPath, "utf8");
    // Simple regex: capture task id, phase id, status, goal
    // Phase wraps tasks; we grab phase id from the nearest preceding <phase id="N">.
    const taskRegex = /<task\s+id="([^"]+)"[^>]*status="([^"]+)"[^>]*>([\s\S]*?)<\/task>/g;
    let m;
    while ((m = taskRegex.exec(src)) !== null) {
      const id = m[1];
      const status = m[2];
      const inner = m[3];
      const goalMatch = inner.match(/<goal>([\s\S]*?)<\/goal>/);
      const goal = goalMatch ? goalMatch[1].trim() : "";
      if (status === "done") {
        state.doneTasksCount++;
      } else if (status !== "cancelled") {
        state.openTasks.push({ id, status, goal: goal.length > 260 ? goal.slice(0, 259) + "â€¦" : goal });
      }
    }
  }

  // DECISIONS.xml â€” latest N decisions with title
  const decisionsPath = path.join(planningDir, "DECISIONS.xml");
  if (exists(decisionsPath)) {
    const src = fs.readFileSync(decisionsPath, "utf8");
    const decisionRegex = /<decision\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/decision>/g;
    const all = [];
    let m;
    while ((m = decisionRegex.exec(src)) !== null) {
      const id = m[1];
      const inner = m[2];
      const titleMatch = inner.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/);
      all.push({
        id,
        title: titleMatch ? titleMatch[1].trim() : id,
        summary: summaryMatch ? summaryMatch[1].trim().slice(0, 400) : null,
      });
    }
    // Take the last 12.
    state.recentDecisions = all.slice(-12).reverse();
  }

  console.log(
    `  [state] phase=${state.currentPhase} Â· open=${state.openTasks.length} Â· done=${state.doneTasksCount} Â· decisions=${state.recentDecisions.length}`
  );
  return state;
}

function writeCatalogTs(catalog, requirementsHistory, currentRequirements, findings, planningState) {
  console.log("  [write] lib/catalog.generated.ts");
  const out = `/**
 * Auto-generated from skills/, agents/, templates/, and
 * evals/REQUIREMENTS-VERSIONS.md. DO NOT EDIT BY HAND.
 */

export interface CatalogSkill {
  id: string;
  name: string;
  description: string;
  imagePath?: string | null;
  origin?: "human-authored" | "emergent" | "inherited" | "official" | "internal" | null;
  authoredBy?: string | null;
  authoredOn?: string | null;
  excludedFromDefaultInstall?: boolean;
  frameworkSkill?: boolean;
  source?: "framework" | null;
  file: string;
  bodyHtml: string;
  bodyRaw: string;
}
export interface CatalogAgent {
  id: string;
  name: string;
  description: string;
  tools: string | null;
  color: string | null;
  file: string;
  bodyHtml: string;
  bodyRaw: string;
}
export interface CatalogCommand {
  id: string;
  name: string;
  description: string;
  agent: string | null;
  argumentHint: string | null;
  file: string;
  bodyHtml: string;
  bodyRaw: string;
}
export interface CatalogTemplate {
  path: string;
  bytes: number;
}
export interface RequirementsVersion {
  version: string;
  date: string;
  rawBody: string;
  sections: Record<string, string>;
}
export interface CurrentRequirementsFile {
  project: string;
  species?: string | null;
  id?: string;
  version: string;
  path: string;
  bytes: number;
  label?: string;
  commit?: string;
  isSnapshot?: boolean;
  content?: string;
  sourcePath?: string;
}

export interface Finding {
  slug: string;
  title: string;
  date: string | null;
  file: string;
  bodyRaw: string;
  bodyHtml: string;
  summary: string;
  projects: string[];
  round: string | null;
  gadVersion: string | null;
}

export interface WorkflowParticipants {
  skills: string[];
  agents: string[];
  cli: string[];
  artifacts: string[];
}
export interface WorkflowLiveGraphNode {
  id: string;
  type: "live";
  position: { x: number; y: number };
  data: {
    label: string;
    kind: "skill" | "agent" | "cli" | "artifact" | "decision";
    count?: number;
  };
}
export interface WorkflowLiveGraphEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}
export interface WorkflowLiveGraph {
  nodes: WorkflowLiveGraphNode[];
  edges: WorkflowLiveGraphEdge[];
}
export interface WorkflowConformance {
  /** (matching âˆ’ extra âˆ’ out_of_order) / expected â€” advisory score per gad-173 */
  score: number;
  matched: number;
  extra: number;
  out_of_order: number;
  expected: number;
}
export interface WorkflowEmergentSupport {
  /** Number of distinct instances the pattern was observed in. */
  phases: number;
  /** Edge stability across instances (0..1). v1 always reports 1. */
  stability: number;
}
export interface Workflow {
  slug: string;
  name: string;
  description: string;
  trigger: string;
  participants: WorkflowParticipants;
  parentWorkflow: string | null;
  relatedPhases: string[];
  origin: "authored" | "emergent";
  mermaidBody: string;
  bodyHtml: string;
  file: string;
  /** Computed actual graph for authored workflows (populated when trace data exists). */
  liveGraph?: WorkflowLiveGraph;
  /** Conformance score vs. authored expected graph (advisory). */
  conformance?: WorkflowConformance;
  /** Only present on emergent workflows â€” detector support metrics. */
  support?: WorkflowEmergentSupport;
  /** Only present on emergent workflows â€” which detector produced the candidate. */
  detector?: "skill-level (v2)" | "tool-level (v1)";
}

/**
 * HumanWorkflow â€” hand-authored operator routines (task 44-22). Distinct
 * from Workflow: no trace matching, no conformance score, Mermaid is
 * optional, frontmatter shape is different. Lives under
 * .planning/human-workflows/*.md and surfaces on /planning â†’ Human
 * Workflows tab.
 */
export interface HumanWorkflow {
  slug: string;
  name: string;
  operator: string;
  frequency: string;
  triggers: string[];
  projectsTouched: string[];
  relatedPhases: string[];
  /** Optional â€” may be empty string if no mermaid block is present. */
  mermaidBody: string;
  bodyHtml: string;
  bodyRaw: string;
  file: string;
}

/**
 * Signal â€” trace-based agent-behavior analytics (task 44-21). Pure
 * reducers over the gad-framework-scoped slice of \`.planning/.trace-events.jsonl\`.
 * v1 ships top files, top skills, tool mix, and agent split. Bash command
 * path extraction, WebFetch URL frequency, and tool n-gram sequences are
 * deferred to v2.
 */
export interface SignalToolMixEntry {
  count: number;
  pct: number;
}
export interface Signal {
  totalEvents: number;
  topFiles: { path: string; count: number }[];
  topSkills: { skill: string; count: number }[];
  toolMix: Record<string, SignalToolMixEntry>;
  agentSplit: {
    default: number;
    sub: number;
    byRole: Record<string, number>;
  };
}

/**
 * ContextFramework is a bundle that references existing catalog items
 * (skills, agents, workflows) by slug. It is NOT a copy â€” when the
 * referenced items update, every project on the framework picks up the
 * update without re-bundling. Frameworks can extend other frameworks
 * via \`extends\` (e.g. a future "GAD-lite" inherits from "gad").
 * Decision gad-179.
 */
export interface ContextFramework {
  slug: string;
  name: string;
  description: string;
  version: string;
  /** Optional parent framework slug â€” this framework inherits its bundle and can override. */
  extends: string | null;
  skills: string[];
  agents: string[];
  workflows: string[];
  canonicalProjects: string[];
  bodyHtml: string;
  bodyRaw: string;
  file: string;
}

export interface PlanningTask {
  id: string;
  status: string;
  goal: string;
}
export interface PlanningPhase {
  id: string;
  title: string;
  status: string;
}
export interface PlanningDecision {
  id: string;
  title: string;
  summary: string | null;
}
export interface PlanningState {
  currentPhase: string | null;
  milestone: string | null;
  nextAction: string | null;
  lastUpdated: string | null;
  phases: PlanningPhase[];
  openTasks: PlanningTask[];
  doneTasksCount: number;
  recentDecisions: PlanningDecision[];
}

export const SKILLS: CatalogSkill[] = ${JSON.stringify(catalog.skills, null, 2)};
export const AGENTS: CatalogAgent[] = ${JSON.stringify(catalog.agents, null, 2)};
export const COMMANDS: CatalogCommand[] = ${JSON.stringify(catalog.commands, null, 2)};
export const TEMPLATES: CatalogTemplate[] = ${JSON.stringify(catalog.templates, null, 2)};

/**
 * Which framework skills are inherited (copied) into each eval project's
 * template/skills/ directory. A skill with a non-empty list is something eval
 * agents see in their starting workspace; a skill with an empty list lives
 * only at the framework level and is not yet part of any eval's bootstrap set.
 */
export const SKILL_INHERITANCE: Record<string, string[]> = ${JSON.stringify(catalog.inheritance || {}, null, 2)};

export const REQUIREMENTS_HISTORY: RequirementsVersion[] = ${JSON.stringify(requirementsHistory, null, 2)};
export const CURRENT_REQUIREMENTS: CurrentRequirementsFile[] = ${JSON.stringify(currentRequirements, null, 2)};

export const FINDINGS: Finding[] = ${JSON.stringify(findings || [], null, 2)};

export const WORKFLOWS: Workflow[] = ${JSON.stringify(catalog.workflows || [], null, 2)};

export const HUMAN_WORKFLOWS: HumanWorkflow[] = ${JSON.stringify(catalog.humanWorkflows || [], null, 2)};

export const SIGNAL: Signal = ${JSON.stringify(catalog.signal || { totalEvents: 0, topFiles: [], topSkills: [], toolMix: {}, agentSplit: { default: 0, sub: 0, byRole: {} } }, null, 2)};

export const CONTEXT_FRAMEWORKS: ContextFramework[] = ${JSON.stringify(catalog.contextFrameworks || [], null, 2)};

export const PLANNING_STATE: PlanningState = ${JSON.stringify(planningState || null, null, 2)};

export const GITHUB_REPO = "https://github.com/MagicbornStudios/get-anything-done";
`;
  ensureDir(path.dirname(CATALOG_FILE));
  fs.writeFileSync(CATALOG_FILE, out, "utf8");
}

// -------------------------------------------------------------------------
// Findings + experiment log â€” parse into round summaries
// -------------------------------------------------------------------------

function parseFindings() {
  const out = [];
  if (!exists(EVALS_DIR)) return out;
  for (const name of fs.readdirSync(EVALS_DIR).sort()) {
    if (!name.startsWith("FINDINGS-") || !name.endsWith(".md")) continue;
    const file = path.join(EVALS_DIR, name);
    const fullSrc = fs.readFileSync(file, "utf8");
    const { data: meta, body: src } = parseFrontmatter(fullSrc);
    // Slug: strip FINDINGS- prefix and .md suffix.
    const slug = name.replace(/^FINDINGS-/, "").replace(/\.md$/, "").toLowerCase();
    // Title: first H1 heading, or derive from filename.
    const h1Match = src.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1].trim() : name.replace(/\.md$/, "");
    // Date: frontmatter wins, otherwise embedded in filename.
    const dateMatch = name.match(/FINDINGS-(\d{4}-\d{2}-\d{2})/);
    const date = meta.date || (dateMatch ? dateMatch[1] : null);
    const summary = firstParagraph(src, 300);
    const projects = Array.isArray(meta.projects) ? meta.projects : [];
    const round = meta.round != null && meta.round !== "" ? String(meta.round) : null;
    const gadVersion = meta.gad_version || meta.gadVersion || null;
    out.push({
      slug,
      title,
      date,
      file: `vendor/get-anything-done/evals/${name}`,
      bodyRaw: src,
      bodyHtml: renderMarkdown(src),
      summary,
      projects,
      round,
      gadVersion,
    });
  }
  return out;
}

function parseRoundSummaries() {
  console.log("[2f/4] Parsing experiment log + findings");
  const expPath = path.join(EVALS_DIR, "EXPERIMENT-LOG.md");
  const findingsRound3Path = path.join(EVALS_DIR, "FINDINGS-2026-04-08-round-3.md");
  const findingsGeneralPath = path.join(EVALS_DIR, "FINDINGS-2026-04-08.md");
  const rounds = [];
  if (exists(expPath)) {
    const text = fs.readFileSync(expPath, "utf8").replace(/\r\n/g, "\n");
    const chunks = text.split(/\n## /);
    for (const chunk of chunks) {
      const header = (chunk.split("\n")[0] ?? "").trim();
      // Match "Round 1", "Round 1 â€” â€¦", "Round 1 - â€¦", or "Round 1:"
      const m = header.match(/^(Round\s*\d+)\s*[\u2014\u2013:\-]?\s*(.*)$/i);
      if (!m) continue;
      const round = m[1];
      const title = m[2]?.trim() || "";
      const body = chunk.split("\n").slice(1).join("\n").trim();
      rounds.push({ round, title, body });
    }
  }
  const findings = {
    round3: exists(findingsRound3Path) ? fs.readFileSync(findingsRound3Path, "utf8") : null,
    general: exists(findingsGeneralPath) ? fs.readFileSync(findingsGeneralPath, "utf8") : null,
  };
  console.log(`  [parse] ${rounds.length} rounds in experiment log`);
  return { rounds, findings };
}

/**
 * Normalize human_review into the rubric shape. Legacy single-score runs get
 * a synthetic `overall` dimension so the site can render a consistent format.
 * New rubric runs pass through unchanged. Computes aggregate from dimensions
 * if the run hasn't pre-computed one.
 */
function normalizeHumanReviewPrebuild(humanReview) {
  if (!humanReview) {
    return {
      rubric_version: "none",
      dimensions: {},
      aggregate_score: null,
      notes: null,
      reviewed_by: null,
      reviewed_at: null,
      is_legacy: true,
      is_empty: true,
    };
  }
  // Already rubric format
  if (humanReview.dimensions != null) {
    const dims = humanReview.dimensions;
    let aggregate = humanReview.aggregate_score;
    if (aggregate == null) {
      // Attempt to compute from scored dimensions (simple average when weights unknown)
      const scores = Object.values(dims)
        .map((d) => d && typeof d.score === "number" ? d.score : null)
        .filter((s) => s != null);
      if (scores.length > 0) {
        aggregate = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4);
      }
    }
    return {
      rubric_version: humanReview.rubric_version ?? "v1",
      dimensions: dims,
      aggregate_score: aggregate,
      notes: humanReview.notes ?? null,
      reviewed_by: humanReview.reviewed_by ?? null,
      reviewed_at: humanReview.reviewed_at ?? null,
      is_legacy: false,
      is_empty: Object.values(dims).every((d) => !d || d.score == null),
    };
  }
  // Legacy single-score â€” synthesize `overall`
  const score = typeof humanReview.score === "number" ? humanReview.score : null;
  return {
    rubric_version: "legacy-v0",
    dimensions: {
      overall: { score, notes: humanReview.notes ?? null },
    },
    aggregate_score: score,
    notes: humanReview.notes ?? null,
    reviewed_by: humanReview.reviewed_by ?? null,
    reviewed_at: humanReview.reviewed_at ?? null,
    is_legacy: true,
    is_empty: score == null,
  };
}

/**
 * Load the game requirements XML content for a run, keyed by
 * run.requirements_version. Returns { filename, content } or null when no
 * matching file is found. Used by the Playable Archive popup (and eventually
 * any per-run page that wants to show the spec the run was measured against).
 *
 * Strategy:
 *  1. For pre-v4 runs, try the git-history snapshots at
 *     public/downloads/requirements/*.md (we extracted these in task 22-11).
 *  2. For v4 runs, read the current template/.planning/REQUIREMENTS.xml.
 *  3. Fall back to the REQUIREMENTS.md meta file at evals/<project>/REQUIREMENTS.md
 *     when nothing else resolves.
 *
 * Each run gets a REQUIREMENTS_BY_RUN entry; the UI can then pop up a modal
 * showing the file content without a network fetch.
 */
function loadRequirementsForRun(project, species, requirementsVersion) {
  const currentTemplateVersion = 'v5';
  if (requirementsVersion === currentTemplateVersion || requirementsVersion === 'v4') {
    const speciesDir = species
      ? path.join(EVALS_DIR, project, 'species', species)
      : path.join(EVALS_DIR, project);
    const candidates = [
      path.join(speciesDir, 'template', '.planning', 'REQUIREMENTS.xml'),
      path.join(speciesDir, 'template', 'REQUIREMENTS.xml'),
    ];
    for (const candidate of candidates) {
      if (exists(candidate)) {
        const content = fs.readFileSync(candidate, 'utf8');
        return {
          filename: `REQUIREMENTS.xml (${requirementsVersion})`,
          path: candidate.replace(REPO_ROOT, '').replace(/\\/g, '/').replace(/^\//, ''),
          content,
          format: 'xml',
        };
      }
    }
  }

  // Priority 2: historical snapshot from git-extracted files
  const snapshotDir = path.join(PUBLIC_DIR, 'downloads', 'requirements');
  if (exists(snapshotDir)) {
    // Snapshot naming: <project>-EVAL-REQUIREMENTS-<date>-<label>.md
    // For v1/v2 we use date-based matching: v1 â‰ˆ 2026-04-06, v2 â‰ˆ 2026-04-07
    const snapshotMap = {
      v1: '2026-04-06-pre-gates',
      v2: '2026-04-07-hosted-demo-added',
    };
    const snapshotSlug = snapshotMap[requirementsVersion];
    if (snapshotSlug) {
      // Phase 43: snapshots are written keyed by old project name
      // ("escape-the-dungeon") because they were extracted from git history
      // before the species split. Keep that as the lookup key.
      const base = project.startsWith('escape-the-dungeon')
        ? 'escape-the-dungeon'
        : project;
      const snapshotPath = path.join(
        snapshotDir,
        `${base}-EVAL-REQUIREMENTS-${snapshotSlug}.md`
      );
      if (exists(snapshotPath)) {
        return {
          filename: `REQUIREMENTS.md snapshot (${requirementsVersion}, ${snapshotSlug.split('-').slice(0, 3).join('-')})`,
          path: `downloads/requirements/${path.basename(snapshotPath)}`,
          content: fs.readFileSync(snapshotPath, 'utf8'),
          format: 'md',
        };
      }
    }
  }

  // Priority 3: the current REQUIREMENTS.md meta file for the species
  const metaPath = species
    ? path.join(EVALS_DIR, project, 'species', species, 'REQUIREMENTS.md')
    : path.join(EVALS_DIR, project, 'REQUIREMENTS.md');
  if (exists(metaPath)) {
    return {
      filename: `REQUIREMENTS.md (eval meta)`,
      path: metaPath.replace(REPO_ROOT, '').replace(/\\/g, '/').replace(/^\//, ''),
      content: fs.readFileSync(metaPath, 'utf8'),
      format: 'md',
    };
  }

  return null;
}

/**
 * Pick the "top skill used" for a run â€” the single most load-bearing skill
 * we can surface. Heuristic: largest skill file by bytes in the run's
 * game/.planning/skills/ directory. Returns { filename, content } or null.
 *
 * For runs where the agent only inherited bootstrap skills, this will
 * surface whichever of those two is largest (usually find-sprites since
 * it's the longer doc). For emergent runs that authored new skills, this
 * surfaces the biggest one â€” typically the one that captures the most
 * project-specific knowledge.
 */
function loadTopSkillForRun(project, species, version, producedArtifacts) {
  const key = species ? `${project}/${species}/${version}` : `${project}/${version}`;
  const produced = producedArtifacts[key];
  if (!produced || !produced.skillFiles || produced.skillFiles.length === 0) {
    return null;
  }

  const sorted = [...produced.skillFiles].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));
  const top = sorted[0];
  if (!top) return null;

  const speciesRunDir = species
    ? path.join(EVALS_DIR, project, 'species', species, version, 'run')
    : path.join(EVALS_DIR, project, version, 'run');
  const candidates = [
    path.join(speciesRunDir, 'game', '.planning', 'skills', top.name),
    path.join(speciesRunDir, '.planning', 'skills', top.name),
    path.join(speciesRunDir, 'game', 'skills', top.name),
  ];
  for (const candidate of candidates) {
    if (exists(candidate)) {
      return {
        filename: top.name,
        content: fs.readFileSync(candidate, 'utf8'),
        bytes: top.bytes,
        total_skills: produced.skillFiles.length,
      };
    }
  }

  // Couldn't find the file on disk â€” return metadata only
  return {
    filename: top.name,
    content: null,
    bytes: top.bytes,
    total_skills: produced.skillFiles.length,
  };
}

function loadJsonDataPseudoDb() {
  // data/ is our JSON pseudo-database (decision gad-71). Each file is self-describing
  // with a _schema block. Missing files return null so the site renders empty states.
  const result = { openQuestions: null, bugs: null, glossary: null };
  if (!fs.existsSync(DATA_DIR)) return result;

  const read = (name) => {
    const p = path.join(DATA_DIR, name);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      console.warn(`  [data] failed to parse ${name}: ${err.message}`);
      return null;
    }
  };

  result.openQuestions = read("open-questions.json");
  result.bugs = read("bugs.json");
  result.glossary = read("glossary.json");

  const qCount = result.openQuestions?.questions?.length ?? 0;
  const bCount = result.bugs?.bugs?.length ?? 0;
  const gCount = result.glossary?.terms?.length ?? 0;
  console.log(`  [data] loaded pseudo-db: ${qCount} open question(s), ${bCount} bug(s), ${gCount} glossary term(s)`);
  return result;
}

function readJsonFilesInDir(dirPath, exclude = []) {
  const out = {};
  if (!exists(dirPath)) return out;
  const excludeSet = new Set(exclude.map((x) => x.toLowerCase()));
  const entries = fs.readdirSync(dirPath).filter((name) => name.endsWith(".json"));
  for (const name of entries) {
    if (excludeSet.has(name.toLowerCase())) continue;
    const p = path.join(dirPath, name);
    try {
      out[name] = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      console.warn(`  [db] failed to parse ${path.relative(SITE_ROOT, p)}: ${err.message}`);
    }
  }
  return out;
}

function writeDbJson({ pseudoDb, allDecisions, allTasks, allPhases }) {
  const repoDataFiles = readJsonFilesInDir(DATA_DIR);
  const siteDataFiles = readJsonFilesInDir(SITE_DATA_DIR, ["db.json"]);

  const records = [
    {
      id: "decisions-count",
      surface: "/decisions",
      number: `Total decisions (${allDecisions.length})`,
      source: "ALL_DECISIONS",
      formula: "parseAllDecisions() over .planning/DECISIONS.xml",
      trust: "deterministic",
      page: "/decisions",
    },
    {
      id: "tasks-count",
      surface: "/planning (tasks tab)",
      number: `Total tasks (${allTasks.length})`,
      source: "ALL_TASKS",
      formula: "parseAllTasks() over .planning/TASK-REGISTRY.xml",
      trust: "deterministic",
      page: "/planning?tab=tasks",
    },
    {
      id: "phases-count",
      surface: "/planning (phases tab)",
      number: `Total phases (${allPhases.length})`,
      source: "ALL_PHASES",
      formula: "parseAllPhases() over .planning/ROADMAP.xml",
      trust: "deterministic",
      page: "/planning?tab=phases",
    },
    {
      id: "glossary-count",
      surface: "/glossary",
      number: `Glossary terms (${pseudoDb?.glossary?.terms?.length ?? 0})`,
      source: "data/glossary.json",
      formula: "terms.length",
      trust: "authored",
      page: "/glossary",
    },
    {
      id: "questions-count",
      surface: "/questions",
      number: `Open questions (${pseudoDb?.openQuestions?.questions?.length ?? 0})`,
      source: "data/open-questions.json",
      formula: "questions.length",
      trust: "authored",
      page: "/questions",
    },
    {
      id: "bugs-count",
      surface: "/planning (bugs tab)",
      number: `Tracked bugs (${pseudoDb?.bugs?.bugs?.length ?? 0})`,
      source: "data/bugs.json",
      formula: "bugs.length",
      trust: "authored",
      page: "/planning?tab=bugs",
    },
  ];

  const payload = {
    _schema: {
      id: "gad-db-viewer-v1",
      generated_by: "scripts/build-site-data.mjs",
      generated_on: new Date().toISOString(),
      source_path: "site/data/db.json",
    },
    collections: {
      active: records,
    },
    records,
    raw: {
      repo_data_files: repoDataFiles,
      site_data_files: siteDataFiles,
    },
  };

  ensureDir(SITE_DATA_DIR);
  fs.writeFileSync(DB_JSON_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`  [write] ${path.relative(SITE_ROOT, DB_JSON_FILE)} (db viewer payload)`);
}

/**
 * Aggregate skill invocations across all generations (species x version) per project.
 * Reads TRACE.json `skill_triggers` from every preserved generation and counts
 * occurrences per skill name. Returns `{ [projectId]: { [skillName]: count } }`.
 *
 * The skill name is normalized to a catalog-style id (e.g. `/gad:plan-phase` -> `gad-plan-phase`).
 */
function projectBroodSkillAggregation() {
  console.log("[2j/4] Aggregating brood-level skill triggers per project");
  const result = {};
  for (const gen of listEvalGenerations()) {
    const traceFile = path.join(gen.dir, "TRACE.json");
    if (!exists(traceFile)) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(traceFile, "utf8"));
    } catch {
      continue;
    }
    const triggers = data.skill_triggers;
    if (!Array.isArray(triggers) || triggers.length === 0) continue;
    if (!result[gen.project]) result[gen.project] = {};
    const bag = result[gen.project];
    for (const entry of triggers) {
      const raw = typeof entry === "string" ? entry : entry?.skill;
      if (!raw || typeof raw !== "string") continue;
      // Normalize to catalog id form: /gad:plan-phase -> gad-plan-phase
      const m = raw.trim().match(/^\/?gad:([\w-]+)/i);
      const id = m ? `gad-${m[1]}` : raw.trim().replace(/^gad:/i, "").replace(/^\//, "");
      if (!id) continue;
      bag[id] = (bag[id] || 0) + 1;
    }
  }
  const projectCount = Object.keys(result).length;
  const totalSkills = Object.values(result).reduce((s, bag) => s + Object.keys(bag).length, 0);
  console.log(`  [agg] ${totalSkills} distinct skill(s) across ${projectCount} project(s)`);
  return result;
}

function writeEvalDataTs(traces, evalTemplates, gadPackTemplate, extras) {
  console.log("[3/4] Writing lib/eval-data.generated.ts");
  const records = traces
    .filter((t) => isImplementationRun(t.project, t.data))
    .map((t) => {
    const d = t.data;
    // Top-level skill_accuracy in v3-era TRACE.json is an object with
    // expected_triggers; scores.skill_accuracy is the aggregated number.
    // Preserve both so the per-run page can render the breakdown.
    const skillAccuracyBreakdown =
      d.skill_accuracy && typeof d.skill_accuracy === "object"
        ? {
            expected_triggers: Array.isArray(d.skill_accuracy.expected_triggers)
              ? d.skill_accuracy.expected_triggers
              : [],
            accuracy:
              typeof d.skill_accuracy.accuracy === "number"
                ? d.skill_accuracy.accuracy
                : null,
          }
        : null;
    return {
      project: t.project,
      species: t.species,
      // Composite id: project/species/version â€” the new canonical row key
      id: t.id,
      version: t.version,
      workflow: inferWorkflow(t.project, { ...d, species: t.species }),
      requirementsVersion: d.requirements_version ?? "unknown",
      date: d.date ?? null,
      gadVersion: d.gad_version ?? null,
      // Phase 25 trace schema v4 fields â€” framework version stamps
      traceSchemaVersion: typeof d.trace_schema_version === "number" ? d.trace_schema_version : 3,
      frameworkVersion: d.framework_version ?? null,
      frameworkCommit: d.framework_commit ?? null,
      frameworkBranch: d.framework_branch ?? null,
      frameworkCommitTs: d.framework_commit_ts ?? null,
      frameworkStamp: d.framework_stamp ?? null,
      runtimeIdentity: d.runtime_identity ?? null,
      runtimesInvolved: Array.isArray(d.runtimes_involved) ? d.runtimes_involved : [],
      traceEvents: Array.isArray(d.trace_events) ? d.trace_events : null,
      agentLineage:
        d.agent_lineage && typeof d.agent_lineage === "object"
          ? d.agent_lineage
          : summarizeAgentLineage({
              traceEvents: Array.isArray(d.trace_events) ? d.trace_events : null,
              runtimeIdentity: d.runtime_identity ?? null,
              runtimesInvolved: Array.isArray(d.runtimes_involved) ? d.runtimes_involved : [],
            }),
      evalType: d.eval_type ?? "implementation",
      contextMode: d.context_mode ?? null,
      timing: d.timing ?? null,
      tokenUsage: d.token_usage ?? null,
      gitAnalysis: d.git_analysis ?? null,
      requirementCoverage: d.requirement_coverage ?? null,
      workflowEmergence: d.workflow_emergence ?? null,
      planningQuality: d.planning_quality ?? null,
      scores: d.scores ?? {},
      humanReview: d.human_review ?? null,
      humanReviewNormalized: normalizeHumanReviewPrebuild(d.human_review),
      skillAccuracyBreakdown,
      skillsProvenance: d.skills_provenance
        ? {
            installed: Array.isArray(d.skills_provenance.installed) ? d.skills_provenance.installed : [],
            inherited: Array.isArray(d.skills_provenance.inherited) ? d.skills_provenance.inherited : [],
            startSnapshot: Array.isArray(d.skills_provenance.start_snapshot) ? d.skills_provenance.start_snapshot : [],
            endSnapshot: Array.isArray(d.skills_provenance.end_snapshot) ? d.skills_provenance.end_snapshot : [],
            skillsAuthored: Array.isArray(d.skills_provenance.skills_authored) ? d.skills_provenance.skills_authored : [],
          }
        : null,
      requirementsDoc: loadRequirementsForRun(t.project, t.species, d.requirements_version ?? 'v4'),
      topSkill: loadTopSkillForRun(t.project, t.species, t.version, extras.producedArtifacts ?? {}),
    };
  });

  // ---- Derived metrics (phase 27 track 3, task 27-11) ----
  // Compute per-run derived metrics from existing v3 fields plus preserved
  // runtime/lineage metadata when available.
  for (const r of records) {
    const composite = r.scores.composite ?? 0;
    const humanScore = r.humanReview?.score;
    const pq = r.planningQuality;
    const timing = r.timing;
    const ga = r.gitAnalysis;
    const produced = extras.producedArtifacts?.[r.id];

    r.derived = {
      // |composite - human_review| â€” flags runs where process metrics lie
      divergence_score:
        typeof humanScore === "number"
          ? Math.abs(composite - humanScore)
          : null,
      // tasks_planned - tasks_completed
      plan_adherence_delta:
        pq && typeof pq.tasks_planned === "number" && typeof pq.tasks_completed === "number"
          ? pq.tasks_planned - pq.tasks_completed
          : null,
      // total produced skills + agents + planning files / duration_minutes
      produced_artifact_density:
        produced && timing && typeof timing.duration_minutes === "number" && timing.duration_minutes > 0
          ? (
              (produced.skillFiles?.length ?? 0) +
              (produced.agentFiles?.length ?? 0) +
              (produced.planningFiles?.length ?? 0)
            ) / timing.duration_minutes
          : null,
      // Stubbed â€” require trace v4 events (phase 25)
      tool_use_mix: null,
      skill_to_tool_ratio: null,
      subagent_utilization:
        r.agentLineage && typeof r.agentLineage.total_agents === "number" && r.agentLineage.total_agents > 0
          ? (r.agentLineage.subagent_count ?? 0) / r.agentLineage.total_agents
          : null,
      // total_commits
      total_commits: ga?.total_commits ?? null,
      // batch vs atomic â€” 1 means all atomic, 0 means all batched
      commit_discipline:
        ga && typeof ga.total_commits === "number" && ga.total_commits > 0
          ? (ga.task_id_commits ?? 0) / ga.total_commits
          : null,
    };
  }

  const playable = {};
  for (const r of records) {
    // Phase 43: playable index keyed by project/species/version.
    const speciesSegment = r.species ? r.species : null;
    const playablePath = speciesSegment
      ? path.join(PLAYABLE_DIR, r.project, speciesSegment, r.version, "index.html")
      : path.join(PLAYABLE_DIR, r.project, r.version, "index.html");
    if (exists(playablePath)) {
      const urlPath = speciesSegment
        ? `/playable/${r.project}/${speciesSegment}/${r.version}/index.html`
        : `/playable/${r.project}/${r.version}/index.html`;
      playable[r.id] = urlPath;
    }
  }

  const out = `/**
 * Auto-generated from evals/<project>/<version>/TRACE.json files.
 * DO NOT EDIT BY HAND â€” run \`npm run prebuild\` to regenerate.
 */

export type Workflow = "gad" | "bare" | "emergent";

export type EvalScores = {
  requirement_coverage?: number | null;
  planning_quality?: number | null;
  per_task_discipline?: number | null;
  skill_accuracy?: number | null;
  time_efficiency?: number | null;
  human_review?: number | null;
  workflow_emergence?: number | null;
  implementation_quality?: number | null;
  iteration_evidence?: number | null;
  composite?: number | null;
} & Record<string, number | null | undefined>;

export interface EvalRunRecord {
  project: string;
  species?: string | null;
  // Composite id project/species/version (phase 43)
  id?: string;
  version: string;
  workflow: Workflow;
  requirementsVersion: string;
  date: string | null;
  gadVersion: string | null;
  traceSchemaVersion: number;
  frameworkVersion: string | null;
  frameworkCommit: string | null;
  frameworkBranch: string | null;
  frameworkCommitTs: string | null;
  frameworkStamp: string | null;
  runtimeIdentity: Record<string, unknown> | null;
  runtimesInvolved: Array<Record<string, unknown>>;
  traceEvents: Array<Record<string, unknown>> | null;
  agentLineage:
    | {
        source: "trace-events" | "runtime-only" | "missing";
        has_lineage: boolean;
        trace_event_count: number;
        events_with_agent: number;
        missing_agent_events: number;
        total_agents: number;
        root_agent_count: number;
        subagent_count: number;
        max_depth_observed: number | null;
        runtimes: Array<{ id: string; count: number }>;
        agents: Array<{
          agent_id: string | null;
          agent_role: string | null;
          runtime: string | null;
          parent_agent_id: string | null;
          root_agent_id: string | null;
          depth: number | null;
          model_profile: string | null;
          resolved_model: string | null;
          event_count: number;
          tool_use_count: number;
          skill_invocation_count: number;
          subagent_spawn_count: number;
          file_mutation_count: number;
        }>;
      }
    | null;
  evalType: string;
  contextMode: string | null;
  timing:
    | ({
        duration_minutes?: number | null;
        phases_completed?: number | null;
        tasks_completed?: number | null;
      } & Record<string, unknown>)
    | null;
  tokenUsage:
    | ({
        total_tokens?: number | null;
        tool_uses?: number | null;
        note?: string | null;
      } & Record<string, unknown>)
    | null;
  gitAnalysis:
    | ({
        total_commits?: number | null;
        task_id_commits?: number | null;
        batch_commits?: number | null;
        per_task_discipline?: number | null;
      } & Record<string, unknown>)
    | null;
  requirementCoverage:
    | ({
        total_criteria?: number | null;
        gate_failed?: boolean | null;
        gate_notes?: string | null;
        fully_met?: number | null;
        partially_met?: number | null;
        not_met?: number | null;
        coverage_ratio?: number | null;
      } & Record<string, unknown>)
    | null;
  workflowEmergence:
    | ({
        created_task_lists?: boolean | null;
        created_state_tracking?: boolean | null;
        created_architecture_docs?: boolean | null;
        created_reusable_skills?: boolean | null;
        emergence_score?: number | null;
      } & Record<string, unknown>)
    | null;
  planningQuality:
    | ({
        phases_planned?: number | null;
        tasks_planned?: number | null;
        tasks_completed?: number | null;
        decisions_captured?: number | null;
      } & Record<string, unknown>)
    | null;
  derived?: {
    divergence_score: number | null;
    plan_adherence_delta: number | null;
    produced_artifact_density: number | null;
    tool_use_mix: Record<string, number> | null;
    skill_to_tool_ratio: number | null;
    subagent_utilization: number | null;
    total_commits: number | null;
    commit_discipline: number | null;
  };
  scores: EvalScores;
  humanReview:
    | ({
        score?: number | null;
        notes?: string | null;
        reviewed_by?: string | null;
        reviewed_at?: string | null;
      } & Record<string, unknown>)
    | null;
  humanReviewNormalized: {
    rubric_version: string;
    dimensions: Record<string, { score: number | null; notes: string | null }>;
    aggregate_score: number | null;
    notes: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    is_legacy: boolean;
    is_empty: boolean;
  };
  requirementsDoc: {
    filename: string;
    path: string;
    content: string;
    format: 'xml' | 'md';
  } | null;
  topSkill: {
    filename: string;
    content: string | null;
    bytes: number;
    total_skills: number;
  } | null;
  skillAccuracyBreakdown:
    | {
        expected_triggers: Array<{
          skill: string;
          when?: string;
          triggered: boolean;
          note?: string;
        } & Record<string, unknown>>;
        accuracy: number | null;
      }
    | null;
  skillsProvenance:
    | {
        installed: Array<{ name: string; source: string; type: string }>;
        inherited: Array<{ name: string; source: string; type: string }>;
        startSnapshot: string[];
        endSnapshot: string[];
        skillsAuthored: string[];
      }
    | null;
}

export interface EvalTemplateAsset {
  project: string;
  species?: string;
  id?: string;
  zipPath: string;
  bytes: number;
}

export interface PlanningZipAsset {
  project: string;
  species?: string;
  id?: string;
  zipPath: string;
  bytes: number;
  files: number;
}

export interface RoundSummary {
  round: string;
  title: string;
  body: string;
}

export interface EvalProjectMeta {
  id: string;
  // Phase 43: every species row has project + species
  project?: string;
  species?: string;
  name: string;
  description: string | null;
  /** @deprecated Phase 43 dropped greenfield/brownfield mode framing. */
  evalMode?: string | null;
  /** @deprecated Use contextFramework. Legacy field from gad.json workflow key. */
  workflow: string | null;
  /** Canonical context framework slug per decision gad-179; resolves context_framework or workflow from gad.json. */
  contextFramework: string | null;
  baseline: string | { project?: string; species?: string; version?: string; source?: string } | null;
  constraints: Record<string, unknown> | null;
  scoringWeights: Record<string, number> | null;
  humanReviewRubric: {
    version: string;
    dimensions: Array<{
      key: string;
      label: string;
      weight: number;
      description: string;
    }>;
  } | null;
  domain: string | null;
  techStack: string | null;
  buildRequirement: string | null;
  published?: boolean;
}

export interface ProducedArtifacts {
  skillFiles: Array<{ name: string; bytes: number; content?: string | null; file?: string | null }>;
  agentFiles: Array<{ name: string; bytes: number }>;
  planningFiles: Array<{ name: string; bytes: number }>;
  workflowNotes: Array<{ name: string; bytes: number }>;
}

export const EVAL_RUNS: EvalRunRecord[] = ${JSON.stringify(records, null, 2)};

export const EVAL_TEMPLATES: EvalTemplateAsset[] = ${JSON.stringify(evalTemplates, null, 2)};

export const PLANNING_ZIPS: PlanningZipAsset[] = ${JSON.stringify(extras.planningZips ?? [], null, 2)};

export const GAD_PACK_TEMPLATE = ${JSON.stringify(
    gadPackTemplate
      ? { zipPath: `/${gadPackTemplate.path}`, bytes: gadPackTemplate.bytes }
      : null,
    null,
    2
  )};

export const ROUND_SUMMARIES: RoundSummary[] = ${JSON.stringify(extras.rounds ?? [], null, 2)};

export const EVAL_PROJECTS: EvalProjectMeta[] = ${JSON.stringify(extras.evalProjects ?? [], null, 2)};

export const PRODUCED_ARTIFACTS: Record<string, ProducedArtifacts> = ${JSON.stringify(extras.producedArtifacts ?? {}, null, 2)};

export const PLAYABLE_INDEX: Record<string, string> = ${JSON.stringify(playable, null, 2)};

export interface OpenQuestion {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  context: string;
  related_decisions: string[];
  related_requirements: string[];
  opened_on: string;
  resolved_on: string | null;
  resolution: string | null;
}

export interface BugRecord {
  id: string;
  title: string;
  project: string;
  version: string;
  observed_on: string;
  severity: string;
  status: string;
  description: string;
  expected: string;
  reproduction: string;
  related_requirement?: string;
  related_runs?: Array<{ project: string; version: string }>;
}

export const OPEN_QUESTIONS: OpenQuestion[] = ${JSON.stringify(extras.pseudoDb?.openQuestions?.questions ?? [], null, 2)};

export const OPEN_QUESTIONS_UPDATED: string | null = ${JSON.stringify(extras.pseudoDb?.openQuestions?._last_updated ?? null)};

export const BUGS: BugRecord[] = ${JSON.stringify(extras.pseudoDb?.bugs?.bugs ?? [], null, 2)};

export const BUGS_UPDATED: string | null = ${JSON.stringify(extras.pseudoDb?.bugs?._last_updated ?? null)};

export interface GlossaryTerm {
  id: string;
  term: string;
  aliases: string[];
  category: string;
  short: string;
  full: string;
  related_decisions: string[];
  related_terms: string[];
}

export const GLOSSARY: GlossaryTerm[] = ${JSON.stringify(extras.pseudoDb?.glossary?.terms ?? [], null, 2)};

export const GLOSSARY_UPDATED: string | null = ${JSON.stringify(extras.pseudoDb?.glossary?._last_updated ?? null)};

export interface DecisionRecord {
  id: string;
  title: string;
  summary: string;
  impact: string;
}

/**
 * Every decision in .planning/DECISIONS.xml parsed in full. Source of truth
 * for the /decisions page and for <Ref id="gad-XX" /> cross-linking.
 */
export const ALL_DECISIONS: DecisionRecord[] = ${JSON.stringify((extras.allDecisions ?? []).map(d => ({ id: d.id, title: d.title, summary: d.summary, impact: d.impact })), null, 2)};

export interface TaskRecord {
  id: string;
  phaseId: string;
  status: string;
  agentId: string | null;
  skill: string | null;
  type: string | null;
  goal: string;
  keywords: string[];
  depends: string[];
}

/**
 * Every task in .planning/TASK-REGISTRY.xml. Feeds /planning (tasks tab) + Ref resolution.
 */
export const ALL_TASKS: TaskRecord[] = ${JSON.stringify(extras.allTasks ?? [], null, 2)};

export interface PhaseRecord {
  id: string;
  title: string;
  status: string;
  goal: string;
  outcome: string | null;
}

/**
 * Every phase in .planning/ROADMAP.xml. Feeds /planning (phases tab) + Ref resolution.
 */
export const ALL_PHASES: PhaseRecord[] = ${JSON.stringify(extras.allPhases ?? [], null, 2)};

export interface SearchEntry {
  id: string;
  title: string;
  kind: "decision" | "task" | "phase" | "glossary" | "question" | "bug" | "skill" | "agent" | "command";
  href: string;
  body: string;
}

/**
 * Flat search index over every structured entry on the site. Body is
 * lowercased at prebuild so the client matcher only does substring checks.
 */
export const SEARCH_INDEX: SearchEntry[] = ${JSON.stringify(extras.searchIndex ?? [], null, 2)};

export interface TaskPressureRecord {
  /** Count of <requirement> elements (including inside <addendum>) */
  R: number;
  /** Count of <gate> elements */
  G: number;
  /** Count of amends attribute cross-cuts */
  C: number;
  /** Word count of the requirements text body */
  W: number;
  /** Raw: R + 2*G + C */
  raw: number;
  /** Normalized 0-1 via log2(raw+1) / log2(MAX_EXPECTED+1), MAX_EXPECTED=64 */
  score: number;
}

/**
 * Programmatic task_pressure per requirements version, computed from
 * REQUIREMENTS.xml structure at prebuild. Decision gad-79. Distinct from
 * "game_pressure" which is the in-game player-experience concept. Do not
 * conflate.
 */
export const TASK_PRESSURE: Record<string, TaskPressureRecord> = ${JSON.stringify(extras.taskPressureByVersion ?? {}, null, 2)};

/**
 * Aggregated skill trigger counts across all generations in a project's brood.
 * Keyed by project id, value is \`{ [catalogSkillId]: invocationCount }\`.
 * Built from TRACE.json \`skill_triggers\` arrays across every species and version.
 */
export const BROOD_SKILL_AGGREGATION: Record<string, Record<string, number>> = ${JSON.stringify(extras.broodSkillAggregation ?? {}, null, 2)};

export const WORKFLOW_LABELS: Record<Workflow, string> = {
  gad: "GAD",
  bare: "Bare",
  emergent: "Emergent",
};

export const WORKFLOW_DESCRIPTIONS: Record<Workflow, string> = {
  gad: "Full GAD framework: .planning/ XML, AGENTS.md loop, skill triggers, plan/execute/verify cycle.",
  bare: "No framework. Agent builds the game however it wants. Workflow artifacts only mandated to live under game/.planning/.",
  emergent:
    "No framework, but inherits skills from previous bare/emergent runs. Evolves them in place and writes a CHANGELOG.",
};
`;
  ensureDir(path.dirname(GENERATED_FILE));
  fs.writeFileSync(GENERATED_FILE, out, "utf8");
  console.log(`  [write] ${path.relative(SITE_ROOT, GENERATED_FILE)} (${records.length} runs, ${Object.keys(playable).length} playable)`);
}

// -------------------------------------------------------------------------
// 4. Discover playable dist directories already copied into public/playable
// -------------------------------------------------------------------------

function auditPlayable() {
  console.log("[4/4] Auditing public/playable");
  if (!exists(PLAYABLE_DIR)) {
    console.log("  (no playable directory yet â€” run scripts/build-games.mjs to populate)");
    return;
  }
  const found = [];
  // Phase 43: walk project/species/version layout.
  for (const project of fs.readdirSync(PLAYABLE_DIR).sort()) {
    const pd = path.join(PLAYABLE_DIR, project);
    if (!fs.statSync(pd).isDirectory()) continue;
    for (const speciesName of fs.readdirSync(pd).sort()) {
      const spd = path.join(pd, speciesName);
      if (!fs.statSync(spd).isDirectory()) continue;
      // If this looks like a version dir (vN), the playable layout is the
      // legacy flat shape â€” surface it as project/version.
      if (/^v\d+$/.test(speciesName)) {
        if (exists(path.join(spd, "index.html"))) {
          found.push(`${project}/${speciesName}`);
        }
        continue;
      }
      for (const version of fs.readdirSync(spd).sort()) {
        const vd = path.join(spd, version);
        if (!fs.statSync(vd).isDirectory()) continue;
        if (!/^v\d+$/.test(version)) continue;
        if (exists(path.join(vd, "index.html"))) {
          found.push(`${project}/${speciesName}/${version}`);
        }
      }
    }
  }
  console.log(`  [ok] ${found.length} playable build(s): ${found.join(", ") || "(none)"}`);
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// Task 44-30: Emit lib/project-config.generated.ts â€” build-time snapshot of
// all registered GAD projects (planning.roots âˆª evals.roots) from the nearest
// gad-config.toml walking upward from REPO_ROOT. Consumed by the site project
// picker and server-side route scoping. Static; no runtime toml parsing.
// -------------------------------------------------------------------------
function collectRegisteredProjects() {
  // Walk upward from REPO_ROOT collecting every gad-config.toml we find and
  // merging their [[planning.roots]] / [[evals.roots]] entries. We favor the
  // OUTERMOST config (monorepo-level) as the default-id source because that
  // is the one the human operator curates; inner submodule configs typically
  // only register the submodule itself.
  const configs = [];
  const seenPaths = new Set();
  let dir = REPO_ROOT;
  for (let i = 0; i < 8; i += 1) {
    try {
      const cfg = gadConfig.load(dir);
      if (cfg && cfg.configPath && !seenPaths.has(cfg.configPath)) {
        seenPaths.add(cfg.configPath);
        configs.push(cfg);
      }
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const byId = new Map();
  // Iterate outer-to-inner so inner configs can override path data if needed,
  // but monorepo-declared ids are registered first.
  const ordered = [...configs].reverse();
  let defaultId = null;
  for (const cfg of ordered) {
    const configBaseDir = cfg.configPath ? path.dirname(cfg.configPath) : REPO_ROOT;
    const resolveRootPath = (p) => {
      if (!p) return configBaseDir;
      return path.isAbsolute(p) ? p : path.resolve(configBaseDir, p);
    };
    const planningRoots = Array.isArray(cfg.roots)
      ? cfg.roots.filter((r) => r && r.enabled !== false && r.id)
      : [];
    const evalsRoots = Array.isArray(cfg.evalsRoots)
      ? cfg.evalsRoots.filter((r) => r && r.enabled !== false && r.id)
      : [];
    if (defaultId === null && planningRoots.length > 0) {
      defaultId = planningRoots[0].id;
    }
    for (const r of planningRoots) {
      if (!byId.has(r.id)) {
        byId.set(r.id, { id: r.id, kind: "planning", path: resolveRootPath(r.path) });
      }
    }
    for (const r of evalsRoots) {
      const existing = byId.get(r.id);
      if (existing) {
        existing.kind = "both";
      } else {
        byId.set(r.id, { id: r.id, kind: "evals", path: resolveRootPath(r.path) });
      }
    }
  }
  // Fallback: ensure the framework itself is always registered.
  if (!byId.has("get-anything-done")) {
    byId.set("get-anything-done", {
      id: "get-anything-done",
      kind: "planning",
      path: REPO_ROOT,
    });
  }
  const registered = Array.from(byId.values());
  return { registered, defaultId: defaultId || "get-anything-done" };
}

function writeProjectConfigTs() {
  const { registered, defaultId } = collectRegisteredProjects();
  const body = `// AUTO-GENERATED by scripts/build-site-data.mjs — do not edit.
// Task 44-30: build-time snapshot of registered GAD projects from gad-config.toml.

export interface RegisteredProject {
  id: string;
  kind: "planning" | "evals" | "both";
  path: string;
}

export const REGISTERED_PROJECTS: RegisteredProject[] = ${JSON.stringify(registered, null, 2)};

export const DEFAULT_PROJECT_ID: string = ${JSON.stringify(defaultId)};
`;
  ensureDir(path.dirname(PROJECT_CONFIG_FILE));
  fs.writeFileSync(PROJECT_CONFIG_FILE, body, "utf8");
  console.log(`  [write] ${path.relative(SITE_ROOT, PROJECT_CONFIG_FILE)} (${registered.length} projects, default=${defaultId})`);
}

function readTextFileOrFallback(filePath, fallback) {
  if (!exists(filePath)) return fallback;
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function writeDevIdPromptTemplatesTs() {
  const promptsDir = path.join(PUBLIC_DIR, "devid-prompts");
  const updateTemplate = readTextFileOrFallback(
    path.join(promptsDir, "update.md"),
    "Objective: update target component.\nRoute: **{{PAGE_URL}}**\nTarget: {{COMPONENT_TAG}} | {{LABEL}}\nsearch: {{SEARCH_LITERAL}}\ndata-cid: {{CID}}\n",
  );
  const deleteTemplate = readTextFileOrFallback(
    path.join(promptsDir, "delete.md"),
    "Objective: remove target component.\nRoute: **{{PAGE_URL}}**\nTarget: {{COMPONENT_TAG}} | {{LABEL}}\nsearch: {{SEARCH_LITERAL}}\ndata-cid: {{CID}}\n",
  );
  const updateCompactTemplate = readTextFileOrFallback(
    path.join(promptsDir, "update-compact.md"),
    "Update target.\nRoute: {{PAGE_URL}}\nTarget: {{COMPONENT_TAG}} | {{LABEL}}\nsearch: {{SEARCH_LITERAL}}\ndata-cid: {{CID}}\n",
  );
  const deleteCompactTemplate = readTextFileOrFallback(
    path.join(promptsDir, "delete-compact.md"),
    "Delete target.\nRoute: {{PAGE_URL}}\nTarget: {{COMPONENT_TAG}} | {{LABEL}}\nsearch: {{SEARCH_LITERAL}}\ndata-cid: {{CID}}\nCleanup: remove dead imports/components; typecheck touched package.\n",
  );

  const body = `// AUTO-GENERATED by scripts/build-site-data.mjs — do not edit.
// Source of truth: site/public/devid-prompts/*.md

export const DEVID_UPDATE_TEMPLATE = ${JSON.stringify(updateTemplate)};
export const DEVID_DELETE_TEMPLATE = ${JSON.stringify(deleteTemplate)};
export const DEVID_UPDATE_COMPACT_TEMPLATE = ${JSON.stringify(updateCompactTemplate)};
export const DEVID_DELETE_COMPACT_TEMPLATE = ${JSON.stringify(deleteCompactTemplate)};
`;
  ensureDir(path.dirname(DEVID_PROMPTS_FILE));
  fs.writeFileSync(DEVID_PROMPTS_FILE, body, "utf8");
  console.log(`  [write] ${path.relative(SITE_ROOT, DEVID_PROMPTS_FILE)} (devid prompts)`);
}

function main() {
  console.log("=== build-site-data ===");
  writeProjectConfigTs();
  writeDevIdPromptTemplatesTs();
  rmrf(DOWNLOADS_DIR);
  ensureDir(DOWNLOADS_DIR);
  ensureDir(PLANNING_ZIPS_DIR);
  ensureDir(REQUIREMENTS_DIR);

  const gadPackTemplate = zipGadPackTemplate();
  const evalTemplates = zipEvalTemplates();
  const planningZips = zipPlanningOnlyPerEval();
  const currentRequirements = copyCurrentRequirements();
  const requirementsHistory = parseRequirementsHistory();
  const catalog = scanCatalog();
  const roundData = parseRoundSummaries();
  const findings = parseFindings();
  const planningState = parsePlanningState();
  const evalProjects = scanEvalProjects();
  const producedArtifacts = scanProducedArtifacts();
  const broodSkillAggregation = projectBroodSkillAggregation();
  const traces = findTraceFiles();
  const pseudoDb = loadJsonDataPseudoDb();
  const allDecisions = parseAllDecisions();
  const allTasks = parseAllTasks();
  const allPhases = parseAllPhases();
  writeDbJson({ pseudoDb, allDecisions, allTasks, allPhases });
  const taskPressureByVersion = computeTaskPressurePerVersion(currentRequirements);
  const searchIndex = buildSearchIndex({
    decisions: allDecisions,
    tasks: allTasks,
    phases: allPhases,
    glossary: pseudoDb.glossary?.terms ?? [],
    questions: pseudoDb.openQuestions?.questions ?? [],
    bugs: pseudoDb.bugs?.bugs ?? [],
    skills: catalog.skills,
    agents: catalog.agents,
    commands: catalog.commands,
  });

  writeEvalDataTs(traces, evalTemplates, gadPackTemplate, {
    planningZips,
    rounds: roundData.rounds,
    findings: roundData.findings,
    evalProjects,
    producedArtifacts,
    broodSkillAggregation,
    pseudoDb,
    allDecisions,
    allTasks,
    allPhases,
    searchIndex,
    taskPressureByVersion,
  });
  writeCatalogTs(catalog, requirementsHistory, currentRequirements, findings, planningState);
  writeAgentIngestFiles({
    catalog,
    allDecisions,
    allTasks,
    allPhases,
    pseudoDb,
    currentRequirements,
    searchIndex,
  });
  auditPlayable();
  computeSelfEval();
  validateSiteData();

  console.log("=== done ===");
}

/**
 * Validate site/data/*.json files exist and parse correctly.
 * These are static, hand-curated data files for the landing page
 * (hypotheses, rounds metadata, eval conditions, media refs).
 * Unlike eval-data.generated.ts, these are NOT auto-generated â€”
 * they're imported directly by components as JSON modules.
 *
 * Boundary:
 *   COMPUTED (auto-generated): lib/eval-data.generated.ts, lib/catalog.generated.ts
 *   STATIC  (hand-curated):    site/data/*.json, data/*.json (repo-level pseudo-db)
 */
function computeSelfEval() {
  // Phase 10: self-eval metrics (framework overhead, framework compliance, hydration, skill
  // candidates from pressure) are GAD-framework-specific â€” they read .gad-log/
  // traces, evals/, and GAD's own skill candidates. When compiling for an
  // external project via GAD_PROJECT_ROOT, skip self-eval entirely since the
  // metrics don't apply and the paths wouldn't resolve to anything meaningful.
  if (process.env.GAD_PROJECT_ROOT) {
    console.log("  [self-eval] skipped (GAD_PROJECT_ROOT set â€” framework metrics only apply to GAD itself)");
    return;
  }
  try {
    execSync("node scripts/compute-self-eval.mjs", { cwd: SITE_ROOT, stdio: "inherit" });
  } catch (err) {
    console.warn("  [self-eval] failed:", err.message);
  }
}

function validateSiteData() {
  const siteDataDir = path.join(SITE_ROOT, "data");
  if (!fs.existsSync(siteDataDir)) {
    console.log("  [site-data] no site/data/ directory â€” skipping validation");
    return;
  }
  const files = fs.readdirSync(siteDataDir).filter((f) => f.endsWith(".json"));
  let valid = 0;
  let invalid = 0;
  for (const f of files) {
    try {
      JSON.parse(fs.readFileSync(path.join(siteDataDir, f), "utf8"));
      valid++;
    } catch (err) {
      console.warn(`  [site-data] INVALID JSON: ${f} â€” ${err.message}`);
      invalid++;
    }
  }
  console.log(`  [site-data] validated ${valid} file(s)${invalid ? `, ${invalid} INVALID` : ""}`);
}

main();


