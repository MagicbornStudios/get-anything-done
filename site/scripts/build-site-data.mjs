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
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");
const EVALS_DIR = path.join(REPO_ROOT, "evals");
const PUBLIC_DIR = path.join(SITE_ROOT, "public");
const DOWNLOADS_DIR = path.join(PUBLIC_DIR, "downloads");
const PLAYABLE_DIR = path.join(PUBLIC_DIR, "playable");
const GENERATED_FILE = path.join(SITE_ROOT, "lib", "eval-data.generated.ts");

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

function writeEvalDataTs(traces, evalTemplates, gadPackTemplate) {
  console.log("[3/4] Writing lib/eval-data.generated.ts");
  const records = traces
    .filter((t) => isImplementationRun(t.project, t.data))
    .map((t) => {
    const d = t.data;
    return {
      project: t.project,
      version: t.version,
      workflow: inferWorkflow(t.project, d),
      requirementsVersion: d.requirements_version ?? "unknown",
      date: d.date ?? null,
      gadVersion: d.gad_version ?? null,
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
    };
  });

  const playable = {};
  for (const r of records) {
    const playablePath = path.join(PLAYABLE_DIR, r.project, r.version, "index.html");
    if (exists(playablePath)) {
      playable[`${r.project}/${r.version}`] = `/playable/${r.project}/${r.version}/`;
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
  scores: EvalScores;
  humanReview:
    | ({
        score?: number | null;
        notes?: string | null;
        reviewed_by?: string | null;
        reviewed_at?: string | null;
      } & Record<string, unknown>)
    | null;
}

export interface EvalTemplateAsset {
  project: string;
  zipPath: string;
  bytes: number;
}

export const EVAL_RUNS: EvalRunRecord[] = ${JSON.stringify(records, null, 2)};

export const EVAL_TEMPLATES: EvalTemplateAsset[] = ${JSON.stringify(evalTemplates, null, 2)};

export const GAD_PACK_TEMPLATE = ${JSON.stringify(
    gadPackTemplate
      ? { zipPath: `/${gadPackTemplate.path}`, bytes: gadPackTemplate.bytes }
      : null,
    null,
    2
  )};

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

  const gadPackTemplate = zipGadPackTemplate();
  const evalTemplates = zipEvalTemplates();
  const traces = findTraceFiles();
  writeEvalDataTs(traces, evalTemplates, gadPackTemplate);
  auditPlayable();

  console.log("=== done ===");
}

main();
