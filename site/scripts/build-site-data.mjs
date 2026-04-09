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
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { marked } from "marked";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");
const SKILLS_DIR = path.join(REPO_ROOT, "skills");
const AGENTS_DIR = path.join(REPO_ROOT, "agents");
const COMMANDS_DIR = path.join(REPO_ROOT, "commands", "gad");
const EVALS_DIR = path.join(REPO_ROOT, "evals");
const PUBLIC_DIR = path.join(SITE_ROOT, "public");
const DOWNLOADS_DIR = path.join(PUBLIC_DIR, "downloads");
const REQUIREMENTS_DIR = path.join(DOWNLOADS_DIR, "requirements");
const PLANNING_ZIPS_DIR = path.join(DOWNLOADS_DIR, "planning");
const PLAYABLE_DIR = path.join(PUBLIC_DIR, "playable");
const GENERATED_FILE = path.join(SITE_ROOT, "lib", "eval-data.generated.ts");
const CATALOG_FILE = path.join(SITE_ROOT, "lib", "catalog.generated.ts");

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
function parseFrontmatter(src) {
  if (!src.startsWith("---")) return { data: {}, body: src };
  const end = src.indexOf("\n---", 3);
  if (end < 0) return { data: {}, body: src };
  const header = src.slice(3, end).trim();
  const body = src.slice(end + 4).replace(/^\n/, "");
  const data = {};
  let key = null;
  let buf = "";
  for (const rawLine of header.split("\n")) {
    const line = rawLine;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && !/^\s/.test(rawLine)) {
      if (key) data[key] = buf.trim();
      key = m[1];
      buf = m[2];
    } else if (key) {
      buf += " " + line.trim();
    }
  }
  if (key) data[key] = buf.trim();
  return { data, body };
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
  return result.length > max ? result.slice(0, max - 1) + "…" : result;
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

// Skip these patterns when zipping — keeps downloads lean.
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
  console.log(`  [zip] ${label} → ${path.relative(SITE_ROOT, zipPath)} (${formatBytes(size)})`);
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
  if (!exists(EVALS_DIR)) return results;
  for (const name of fs.readdirSync(EVALS_DIR).sort()) {
    const projectDir = path.join(EVALS_DIR, name);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    if (name.startsWith(".")) continue;
    const templateDir = path.join(projectDir, "template");
    if (!exists(templateDir)) continue;
    const zipPath = path.join(DOWNLOADS_DIR, `eval-${name}-template.zip`);
    const entry = zipDirectory(templateDir, zipPath, `eval:${name}`);
    if (entry) {
      results.push({
        project: name,
        zipPath: `/${entry.path}`,
        bytes: entry.bytes,
      });
    }
  }
  return results;
}

// -------------------------------------------------------------------------
// 2b. Planning-only zips (no source code) — bundles just the planning
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
  console.log(`  [zip] planning:${label} → ${path.relative(SITE_ROOT, zipPath)} (${formatBytes(size)}, ${fileCount} files)`);
  return { path: path.relative(PUBLIC_DIR, zipPath).split(path.sep).join("/"), bytes: size, files: fileCount };
}

function zipPlanningOnlyPerEval() {
  console.log("[2b/4] Zipping planning-only per eval");
  const results = [];
  if (!exists(EVALS_DIR)) return results;
  for (const name of fs.readdirSync(EVALS_DIR).sort()) {
    const projectDir = path.join(EVALS_DIR, name);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    if (name.startsWith(".")) continue;
    const templateDir = path.join(projectDir, "template");
    if (!exists(templateDir)) continue;
    const zipPath = path.join(PLANNING_ZIPS_DIR, `eval-${name}-planning.zip`);
    const entry = zipPlanningOnly(templateDir, zipPath, name);
    if (entry) {
      results.push({
        project: name,
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
  if (!exists(EVALS_DIR)) return traces;
  for (const project of fs.readdirSync(EVALS_DIR).sort()) {
    const projectDir = path.join(EVALS_DIR, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    if (project.startsWith(".")) continue;
    for (const version of fs.readdirSync(projectDir).sort()) {
      if (!/^v\d+$/.test(version)) continue;
      const traceFile = path.join(projectDir, version, "TRACE.json");
      if (!exists(traceFile)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(traceFile, "utf8"));
        traces.push({ project, version, data });
      } catch (err) {
        console.warn(`  [warn] failed to parse ${traceFile}: ${err.message}`);
      }
    }
  }
  return traces;
}

/**
 * Scan each eval project for gad.json + extract scoring weights.
 * Also snapshot eval_mode, workflow, baseline, constraints — used by the
 * /projects/[id] page and the methodology page.
 */
function scanEvalProjects() {
  console.log("[2h/4] Scanning eval project metadata (gad.json)");
  const projects = [];
  if (!exists(EVALS_DIR)) return projects;
  for (const name of fs.readdirSync(EVALS_DIR).sort()) {
    const projectDir = path.join(EVALS_DIR, name);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    if (name.startsWith(".")) continue;
    const gadJsonPath = path.join(projectDir, "gad.json");
    if (!exists(gadJsonPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(gadJsonPath, "utf8"));
      projects.push({
        id: name,
        name,
        description: data.description || null,
        evalMode: data.eval_mode || null,
        workflow: data.workflow || null,
        baseline: data.baseline || null,
        constraints: data.constraints || null,
        scoringWeights: data.scoring?.weights || null,
        humanReviewRubric: data.human_review_rubric || null,
      });
    } catch (err) {
      console.warn(`  [warn] failed to parse ${gadJsonPath}: ${err.message}`);
    }
  }
  console.log(`  [scan] ${projects.length} eval project(s)`);
  return projects;
}

/**
 * Scan each eval run's run/ directory for what the agent produced for itself —
 * workflow notes, written skills, created AGENTS.md, planning artifacts.
 * Returns a map keyed by `${project}/${version}` -> { skillFiles, agentFiles, planningFiles, workflowNotes }.
 */
function scanProducedArtifacts() {
  console.log("[2i/4] Scanning agent-produced artifacts per run");
  const produced = {};
  if (!exists(EVALS_DIR)) return produced;
  for (const project of fs.readdirSync(EVALS_DIR).sort()) {
    const projectDir = path.join(EVALS_DIR, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    if (project.startsWith(".")) continue;
    for (const version of fs.readdirSync(projectDir).sort()) {
      if (!/^v\d+$/.test(version)) continue;
      const runDir = path.join(projectDir, version, "run");
      if (!exists(runDir)) continue;
      const key = `${project}/${version}`;
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
            const size = fs.statSync(path.join(skillDir, f)).size;
            entry.skillFiles.push({ name: f, bytes: size });
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
  console.log(`  [scan] ${Object.keys(produced).length} run(s) with produced artifacts`);
  return produced;
}

const IMPLEMENTATION_WORKFLOWS = new Set(["gad", "bare", "emergent"]);

function inferWorkflow(project, data) {
  if (project.includes("-bare")) return "bare";
  if (project.includes("-emergent")) return "emergent";
  if (data.workflow && IMPLEMENTATION_WORKFLOWS.has(data.workflow)) return data.workflow;
  return "gad";
}

function isImplementationRun(project, data) {
  // cli-efficiency is a tooling eval with workflow="A"/"B" letters — not
  // comparable to implementation eval results.
  if (project.startsWith("cli-efficiency")) return false;
  if (data.eval_type && data.eval_type !== "implementation") return false;
  return true;
}

// -------------------------------------------------------------------------
// Requirements versions — the current v4 and a narrative for v1-v3
// -------------------------------------------------------------------------

function copyCurrentRequirements() {
  console.log("[2c/4] Copying current game requirements");
  const out = [];
  ensureDir(REQUIREMENTS_DIR);
  const projects = ["escape-the-dungeon", "escape-the-dungeon-bare", "escape-the-dungeon-emergent"];
  for (const project of projects) {
    // Try template/.planning/REQUIREMENTS.xml first, then template/REQUIREMENTS.xml.
    const candidates = [
      path.join(EVALS_DIR, project, "template", ".planning", "REQUIREMENTS.xml"),
      path.join(EVALS_DIR, project, "template", "REQUIREMENTS.xml"),
    ];
    const src = candidates.find(exists);
    if (!src) continue;
    const destName = `${project}-REQUIREMENTS-v4.xml`;
    const dest = path.join(REQUIREMENTS_DIR, destName);
    fs.copyFileSync(src, dest);
    const size = fs.statSync(dest).size;
    console.log(`  [copy] ${project} v4 → ${path.relative(SITE_ROOT, dest)} (${formatBytes(size)})`);
    out.push({
      project,
      version: "v4",
      path: `/downloads/requirements/${destName}`,
      bytes: size,
    });
  }
  // Also copy the REQUIREMENTS-VERSIONS.md narrative so users can download the
  // full history as a single file.
  const historyFile = path.join(EVALS_DIR, "REQUIREMENTS-VERSIONS.md");
  if (exists(historyFile)) {
    const dest = path.join(REQUIREMENTS_DIR, "REQUIREMENTS-VERSIONS.md");
    fs.copyFileSync(historyFile, dest);
    console.log(`  [copy] requirements history narrative → ${path.relative(SITE_ROOT, dest)}`);
  }

  // Extract historical REQUIREMENTS.md snapshots from git. These are the eval
  // DESCRIPTION docs (what the eval measures), not the game spec itself — the
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
      `<!-- This is the eval DESCRIPTION doc — what the eval measures — not the\n` +
      `     game spec. The game spec XML lives in template/.planning/REQUIREMENTS.xml\n` +
      `     and was only committed to git starting with v4 (the earlier .planning/\n` +
      `     directories were gitignored). -->\n\n` +
      content;
    fs.writeFileSync(dest, annotated, "utf8");
    const size = fs.statSync(dest).size;
    console.log(`  [git] snapshot ${snap.commit} (${snap.date}) → ${path.relative(SITE_ROOT, dest)} (${formatBytes(size)})`);
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
    const versionMatch = header.match(/^(v\d+)\s*—\s*(\d{4}-\d{2}-\d{2})/);
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
// Catalog scanners — skills, agents, commands
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
  console.log("[2e/4] Scanning catalog (skills, agents, commands, templates)");
  const catalog = { skills: [], agents: [], commands: [], templates: [] };

  if (exists(SKILLS_DIR)) {
    for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) {
        const file = path.join(SKILLS_DIR, entry.name, "SKILL.md");
        if (exists(file)) {
          const src = fs.readFileSync(file, "utf8");
          const { data, body } = parseFrontmatter(src);
          catalog.skills.push({
            id: entry.name,
            name: data.name || entry.name,
            description: data.description || firstParagraph(body, 280),
            file: `vendor/get-anything-done/skills/${entry.name}/SKILL.md`,
            bodyHtml: renderMarkdown(body),
            bodyRaw: body,
          });
        }
      }
    }
  }

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
        tools: data.tools || null,
        color: data.color || null,
        file: `vendor/get-anything-done/agents/${name}`,
        bodyHtml: renderMarkdown(body),
        bodyRaw: body,
      });
    }
  }

  if (exists(COMMANDS_DIR)) {
    for (const name of fs.readdirSync(COMMANDS_DIR).sort()) {
      if (!name.endsWith(".md")) continue;
      const file = path.join(COMMANDS_DIR, name);
      const src = fs.readFileSync(file, "utf8");
      const { data, body } = parseFrontmatter(src);
      const id = name.replace(/\.md$/, "");
      catalog.commands.push({
        id,
        name: data.name || `gad:${id}`,
        description: data.description || firstParagraph(body, 280),
        agent: data.agent || null,
        argumentHint: data["argument-hint"] || null,
        file: `vendor/get-anything-done/commands/gad/${name}`,
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
  // template/skills/<name>.md → the eval copies that skill into its starting state.
  const inheritanceMap = {}; // skillId -> [project...]
  for (const skill of catalog.skills) inheritanceMap[skill.id] = [];
  if (exists(EVALS_DIR)) {
    for (const project of fs.readdirSync(EVALS_DIR).sort()) {
      const skillsDir = path.join(EVALS_DIR, project, "template", "skills");
      if (!exists(skillsDir)) continue;
      for (const file of fs.readdirSync(skillsDir)) {
        if (!file.endsWith(".md")) continue;
        const skillId = file.replace(/\.md$/, "");
        if (inheritanceMap[skillId]) inheritanceMap[skillId].push(project);
      }
    }
  }
  catalog.inheritance = inheritanceMap;

  console.log(
    `  [scan] skills=${catalog.skills.length} agents=${catalog.agents.length} commands=${catalog.commands.length} templates=${catalog.templates.length}`
  );
  const inheritedCount = Object.values(inheritanceMap).filter((v) => v.length > 0).length;
  console.log(`  [scan] ${inheritedCount} skill(s) inherited by at least one eval template`);
  return catalog;
}

// -------------------------------------------------------------------------
// Planning state — parse STATE.xml, TASK-REGISTRY.xml, DECISIONS.xml
// for the /planning meta-transparency page.
// -------------------------------------------------------------------------

function parsePlanningState() {
  console.log("[2g/4] Parsing GAD planning state (STATE, TASKS, DECISIONS)");
  const planningDir = path.join(REPO_ROOT, ".planning");
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

  // ROADMAP.xml — high-level phase list
  const roadmapPath = path.join(planningDir, "ROADMAP.xml");
  if (exists(roadmapPath)) {
    const src = fs.readFileSync(roadmapPath, "utf8");
    const phaseRegex = /<phase\s+id="(\d+(?:\.\d+)?)"[^>]*>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?(?:<status>([^<]*)<\/status>)?[\s\S]*?<\/phase>/g;
    let m;
    while ((m = phaseRegex.exec(src)) !== null) {
      state.phases.push({
        id: m[1],
        title: m[2].trim(),
        status: (m[3] || "planned").trim(),
      });
    }
  }

  // TASK-REGISTRY.xml — tasks (open vs done)
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
        state.openTasks.push({ id, status, goal: goal.length > 260 ? goal.slice(0, 259) + "…" : goal });
      }
    }
  }

  // DECISIONS.xml — latest N decisions with title
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
    `  [state] phase=${state.currentPhase} · open=${state.openTasks.length} · done=${state.doneTasksCount} · decisions=${state.recentDecisions.length}`
  );
  return state;
}

function writeCatalogTs(catalog, requirementsHistory, currentRequirements, findings, planningState) {
  console.log("  [write] lib/catalog.generated.ts");
  const out = `/**
 * Auto-generated from skills/, agents/, commands/gad/, templates/, and
 * evals/REQUIREMENTS-VERSIONS.md. DO NOT EDIT BY HAND.
 */

export interface CatalogSkill {
  id: string;
  name: string;
  description: string;
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
  version: string;
  path: string;
  bytes: number;
  label?: string;
  commit?: string;
  isSnapshot?: boolean;
}

export interface Finding {
  slug: string;
  title: string;
  date: string | null;
  file: string;
  bodyRaw: string;
  bodyHtml: string;
  summary: string;
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

export const PLANNING_STATE: PlanningState = ${JSON.stringify(planningState || null, null, 2)};

export const GITHUB_REPO = "https://github.com/MagicbornStudios/get-anything-done";
`;
  ensureDir(path.dirname(CATALOG_FILE));
  fs.writeFileSync(CATALOG_FILE, out, "utf8");
}

// -------------------------------------------------------------------------
// Findings + experiment log — parse into round summaries
// -------------------------------------------------------------------------

function parseFindings() {
  const out = [];
  if (!exists(EVALS_DIR)) return out;
  for (const name of fs.readdirSync(EVALS_DIR).sort()) {
    if (!name.startsWith("FINDINGS-") || !name.endsWith(".md")) continue;
    const file = path.join(EVALS_DIR, name);
    const src = fs.readFileSync(file, "utf8");
    // Slug: strip FINDINGS- prefix and .md suffix.
    const slug = name.replace(/^FINDINGS-/, "").replace(/\.md$/, "").toLowerCase();
    // Title: first H1 heading, or derive from filename.
    const h1Match = src.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1].trim() : name.replace(/\.md$/, "");
    // Date embedded in the filename if present (FINDINGS-YYYY-MM-DD-xxx.md).
    const dateMatch = name.match(/FINDINGS-(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : null;
    // Summary: first non-heading paragraph.
    const summary = firstParagraph(src, 300);
    out.push({
      slug,
      title,
      date,
      file: `vendor/get-anything-done/evals/${name}`,
      bodyRaw: src,
      bodyHtml: renderMarkdown(src),
      summary,
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
      // Match "Round 1", "Round 1 — …", "Round 1 - …", or "Round 1:"
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
  // Legacy single-score — synthesize `overall`
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
      version: t.version,
      workflow: inferWorkflow(t.project, d),
      requirementsVersion: d.requirements_version ?? "unknown",
      date: d.date ?? null,
      gadVersion: d.gad_version ?? null,
      // Phase 25 trace schema v4 fields — framework version stamps
      traceSchemaVersion: typeof d.trace_schema_version === "number" ? d.trace_schema_version : 3,
      frameworkVersion: d.framework_version ?? null,
      frameworkCommit: d.framework_commit ?? null,
      frameworkBranch: d.framework_branch ?? null,
      frameworkCommitTs: d.framework_commit_ts ?? null,
      frameworkStamp: d.framework_stamp ?? null,
      traceEvents: Array.isArray(d.trace_events) ? d.trace_events : null,
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
    };
  });

  // ---- Derived metrics (phase 27 track 3, task 27-11) ----
  // Compute per-run derived metrics from existing v3 fields. Phase-25-dependent
  // metrics (tool_use_mix, skill_to_tool_ratio, subagent_utilization) stub to
  // null until trace v4 events are available.
  for (const r of records) {
    const composite = r.scores.composite ?? 0;
    const humanScore = r.humanReview?.score;
    const pq = r.planningQuality;
    const timing = r.timing;
    const ga = r.gitAnalysis;
    const produced = extras.producedArtifacts?.[`${r.project}/${r.version}`];

    r.derived = {
      // |composite - human_review| — flags runs where process metrics lie
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
      // Stubbed — require trace v4 events (phase 25)
      tool_use_mix: null,
      skill_to_tool_ratio: null,
      subagent_utilization: null,
      // total_commits
      total_commits: ga?.total_commits ?? null,
      // batch vs atomic — 1 means all atomic, 0 means all batched
      commit_discipline:
        ga && typeof ga.total_commits === "number" && ga.total_commits > 0
          ? (ga.task_id_commits ?? 0) / ga.total_commits
          : null,
    };
  }

  const playable = {};
  for (const r of records) {
    const playablePath = path.join(PLAYABLE_DIR, r.project, r.version, "index.html");
    if (exists(playablePath)) {
      // Explicit filename — Next.js on Vercel does not serve directory index
      // files for public/ subdirectories reliably, so link to index.html.
      playable[`${r.project}/${r.version}`] = `/playable/${r.project}/${r.version}/index.html`;
    }
  }

  const out = `/**
 * Auto-generated from evals/<project>/<version>/TRACE.json files.
 * DO NOT EDIT BY HAND — run \`npm run prebuild\` to regenerate.
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
  traceEvents: Array<Record<string, unknown>> | null;
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
}

export interface EvalTemplateAsset {
  project: string;
  zipPath: string;
  bytes: number;
}

export interface PlanningZipAsset {
  project: string;
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
  name: string;
  description: string | null;
  evalMode: string | null;
  workflow: string | null;
  baseline: string | { project?: string; version?: string; source?: string } | null;
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
}

export interface ProducedArtifacts {
  skillFiles: Array<{ name: string; bytes: number }>;
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

export const FINDINGS_ROUND_3_RAW: string | null = ${JSON.stringify(extras.findings?.round3 ?? null)};
export const FINDINGS_GENERAL_RAW: string | null = ${JSON.stringify(extras.findings?.general ?? null)};

export const EVAL_PROJECTS: EvalProjectMeta[] = ${JSON.stringify(extras.evalProjects ?? [], null, 2)};

export const PRODUCED_ARTIFACTS: Record<string, ProducedArtifacts> = ${JSON.stringify(extras.producedArtifacts ?? {}, null, 2)};

export const PLAYABLE_INDEX: Record<string, string> = ${JSON.stringify(playable, null, 2)};

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
    console.log("  (no playable directory yet — run scripts/build-games.mjs to populate)");
    return;
  }
  const found = [];
  for (const project of fs.readdirSync(PLAYABLE_DIR).sort()) {
    const pd = path.join(PLAYABLE_DIR, project);
    if (!fs.statSync(pd).isDirectory()) continue;
    for (const version of fs.readdirSync(pd).sort()) {
      const vd = path.join(pd, version);
      if (!fs.statSync(vd).isDirectory()) continue;
      if (exists(path.join(vd, "index.html"))) {
        found.push(`${project}/${version}`);
      }
    }
  }
  console.log(`  [ok] ${found.length} playable build(s): ${found.join(", ") || "(none)"}`);
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

function main() {
  console.log("=== build-site-data ===");
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
  const traces = findTraceFiles();

  writeEvalDataTs(traces, evalTemplates, gadPackTemplate, {
    planningZips,
    rounds: roundData.rounds,
    findings: roundData.findings,
    evalProjects,
    producedArtifacts,
  });
  writeCatalogTs(catalog, requirementsHistory, currentRequirements, findings, planningState);
  auditPlayable();

  console.log("=== done ===");
}

main();
