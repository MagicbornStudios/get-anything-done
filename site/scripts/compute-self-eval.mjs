#!/usr/bin/env node
/**
 * Compute self-eval metrics from GAD trace data.
 * Reads .planning/.gad-log/*.jsonl and produces site/data/self-eval.json
 * consumed by the landing page to display real-world GAD usage data.
 *
 * Run: node scripts/compute-self-eval.mjs
 * Called by: prebuild (build-site-data.mjs) or standalone
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });
function renderMarkdown(src) {
  if (!src) return "";
  try { return marked.parse(src, { async: false }); }
  catch { return `<pre>${src.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>`; }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const MONOREPO_ROOT = path.resolve(REPO_ROOT, "..", "..");
const LOG_DIR = path.join(MONOREPO_ROOT, ".planning", ".gad-log");
const OUTPUT = path.join(SITE_ROOT, "data", "self-eval.json");
const CONFIG_PATH = path.join(SITE_ROOT, "data", "self-eval-config.json");
const EVALS_DIR = path.join(REPO_ROOT, "evals");

/** Load pressure + crosscut config with sensible fallbacks (GAD-D-145) */
function loadConfig() {
  const defaults = {
    pressure: { crosscut_weight: 2, high_pressure_threshold: 10 },
    crosscut_detection: {
      systems: ["cli", "site", "eval", "skill", "agent", "trace", "hook", "planning", "state", "decision"],
      min_systems_to_count: 2,
    },
  };
  if (!fs.existsSync(CONFIG_PATH)) return defaults;
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return {
      pressure: { ...defaults.pressure, ...(raw.pressure || {}) },
      crosscut_detection: { ...defaults.crosscut_detection, ...(raw.crosscut_detection || {}) },
    };
  } catch {
    return defaults;
  }
}

const CONFIG = loadConfig();

function readAllEvents() {
  if (!fs.existsSync(LOG_DIR)) return [];
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".jsonl")).sort();
  const events = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(LOG_DIR, f), "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        events.push(JSON.parse(line));
      } catch {}
    }
  }
  return events;
}

function getRuntimeId(runtime) {
  if (!runtime || typeof runtime !== "object") return "unknown";
  if (typeof runtime.id === "string" && runtime.id.trim()) return runtime.id.trim();
  return "unknown";
}

function inferRuntimeIdFromEvent(event) {
  const explicit = getRuntimeId(event?.runtime);
  if (explicit !== "unknown") return explicit;

  const claudeTools = new Set([
    "Agent",
    "Bash",
    "Edit",
    "Glob",
    "Grep",
    "Read",
    "TaskCreate",
    "TaskUpdate",
    "ToolSearch",
    "WebFetch",
    "WebSearch",
    "Write",
  ]);

  if (event?.type === "tool_call" && claudeTools.has(event.tool)) {
    return "claude-code";
  }

  return "unknown";
}

function incrementCounter(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

function readEvalTraces() {
  if (!fs.existsSync(EVALS_DIR)) return [];
  const traces = [];
  const projects = fs.readdirSync(EVALS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const project of projects) {
    const projectDir = path.join(EVALS_DIR, project.name);
    const versions = fs.readdirSync(projectDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    for (const version of versions) {
      const traceFile = path.join(projectDir, version.name, "TRACE.json");
      if (!fs.existsSync(traceFile)) continue;
      try {
        const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
        traces.push({ project: project.name, version: version.name, trace });
      } catch {}
    }
  }
  return traces;
}

function readProjectTraceEvents() {
  const candidateFiles = [
    path.join(MONOREPO_ROOT, ".planning", ".trace-events.jsonl"),
    path.join(REPO_ROOT, ".planning", ".trace-events.jsonl"),
  ];
  const seen = new Set();
  const traces = [];
  for (const traceFile of candidateFiles) {
    if (seen.has(traceFile)) continue;
    seen.add(traceFile);
    if (!fs.existsSync(traceFile)) continue;
    try {
      const lines = fs.readFileSync(traceFile, "utf8").split("\n").filter(Boolean);
      const events = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {}
      }
      traces.push({ traceFile, events });
    } catch {}
  }
  return traces;
}

function estimateTokensFromText(value) {
  if (!value) return 0;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function computeProjectTokenMetrics(traceFiles) {
  if (traceFiles.length === 0) {
    return {
      trace_files: 0,
      trace_events: 0,
      estimated_input_tokens: 0,
      estimated_output_tokens: 0,
      estimated_total_tokens: 0,
      runtime_distribution: [],
      sources: [],
    };
  }

  const runtimeCounts = {};
  const sources = [];
  let traceEvents = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const { traceFile, events } of traceFiles) {
    let sourceInputTokens = 0;
    let sourceOutputTokens = 0;
    for (const event of events) {
      traceEvents += 1;
      const runtimeId = getRuntimeId(event?.runtime);
      incrementCounter(runtimeCounts, runtimeId);

      sourceInputTokens += estimateTokensFromText(event?.inputs);
      sourceOutputTokens += estimateTokensFromText(event?.outputs);
    }
    inputTokens += sourceInputTokens;
    outputTokens += sourceOutputTokens;
    sources.push({
      path: path.relative(MONOREPO_ROOT, traceFile).replace(/\\/g, "/"),
      events: events.length,
      estimated_input_tokens: sourceInputTokens,
      estimated_output_tokens: sourceOutputTokens,
      estimated_total_tokens: sourceInputTokens + sourceOutputTokens,
    });
  }

  return {
    trace_files: traceFiles.length,
    trace_events: traceEvents,
    estimated_input_tokens: inputTokens,
    estimated_output_tokens: outputTokens,
    estimated_total_tokens: inputTokens + outputTokens,
    runtime_distribution: Object.entries(runtimeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([runtime, count]) => ({ runtime, count })),
    sources: sources.sort((a, b) => b.estimated_total_tokens - a.estimated_total_tokens),
  };
}

function computeEvalMetrics(traces) {
  if (traces.length === 0) {
    return {
      runs: 0,
      projects: 0,
      reviewed_runs: 0,
      tokens: {
        total: 0,
        tracked_runs: 0,
        missing_runs: 0,
        avg_per_tracked_run: null,
      },
      tool_uses: {
        total: 0,
        tracked_runs: 0,
      },
      runtime_distribution: [],
      project_breakdown: [],
      latest_run_date: null,
    };
  }

  const runtimeCounts = {};
  const projectAgg = {};
  let reviewedRuns = 0;
  let totalTokens = 0;
  let trackedTokenRuns = 0;
  let missingTokenRuns = 0;
  let totalToolUses = 0;
  let trackedToolRuns = 0;
  let latestRunDate = null;

  for (const { project, version, trace } of traces) {
    if (!projectAgg[project]) {
      projectAgg[project] = {
        project,
        runs: 0,
        reviewed_runs: 0,
        total_tokens: 0,
        tracked_token_runs: 0,
        total_tool_uses: 0,
      };
    }
    const agg = projectAgg[project];
    agg.runs += 1;
    agg.latest_version = version;

    if (trace?.human_review?.score != null) {
      reviewedRuns += 1;
      agg.reviewed_runs += 1;
    }

    const totalRunTokens = trace?.token_usage?.total_tokens;
    if (Number.isFinite(totalRunTokens)) {
      totalTokens += totalRunTokens;
      trackedTokenRuns += 1;
      agg.total_tokens += totalRunTokens;
      agg.tracked_token_runs += 1;
    } else {
      missingTokenRuns += 1;
    }

    const toolUses = trace?.token_usage?.tool_uses;
    if (Number.isFinite(toolUses)) {
      totalToolUses += toolUses;
      trackedToolRuns += 1;
      agg.total_tool_uses += toolUses;
    }

    const runtimes = [];
    if (trace?.runtime_identity) runtimes.push(trace.runtime_identity);
    if (Array.isArray(trace?.runtimes_involved)) runtimes.push(...trace.runtimes_involved);
    const uniqueRuntimeIds = new Set(runtimes.map(getRuntimeId).filter(Boolean));
    if (uniqueRuntimeIds.size === 0) uniqueRuntimeIds.add("unknown");
    for (const runtimeId of uniqueRuntimeIds) incrementCounter(runtimeCounts, runtimeId);

    if (typeof trace?.date === "string" && (!latestRunDate || trace.date > latestRunDate)) {
      latestRunDate = trace.date;
    }
  }

  return {
    runs: traces.length,
    projects: Object.keys(projectAgg).length,
    reviewed_runs: reviewedRuns,
    tokens: {
      total: totalTokens,
      tracked_runs: trackedTokenRuns,
      missing_runs: missingTokenRuns,
      avg_per_tracked_run: trackedTokenRuns > 0 ? Math.round(totalTokens / trackedTokenRuns) : null,
    },
    tool_uses: {
      total: totalToolUses,
      tracked_runs: trackedToolRuns,
    },
    runtime_distribution: Object.entries(runtimeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([runtime, count]) => ({ runtime, count })),
    project_breakdown: Object.values(projectAgg)
      .sort((a, b) => (b.total_tokens || 0) - (a.total_tokens || 0)),
    latest_run_date: latestRunDate,
  };
}

function computeMetrics(events) {
  if (events.length === 0) return null;

  // Tool distribution
  const byTool = {};
  const byDay = {};
  const gadCmds = {};
  const byRuntime = {};
  const sessions = new Set();
  const sessionsByRuntime = {};
  let planningOps = 0;
  let sourceOps = 0;

  for (const e of events) {
    const tool = e.tool || "unknown";
    incrementCounter(byTool, tool);

    const day = e.ts?.slice(0, 10) || "unknown";
    incrementCounter(byDay, day);

    const runtimeId = inferRuntimeIdFromEvent(e);
    incrementCounter(byRuntime, runtimeId);
    if (e.session_id) {
      if (!sessionsByRuntime[runtimeId]) sessionsByRuntime[runtimeId] = new Set();
      sessionsByRuntime[runtimeId].add(e.session_id);
    }

    if (e.session_id) sessions.add(e.session_id);
    if (e.gad_command) incrementCounter(gadCmds, e.gad_command);

    // Framework overhead calculation
    if (e.input_summary) {
      const s = e.input_summary;
      if (
        s.includes(".planning/") ||
        s.includes("STATE.xml") ||
        s.includes("TASK-REGISTRY") ||
        s.includes("DECISIONS.xml") ||
        s.includes("ROADMAP.xml")
      ) {
        planningOps++;
      } else if (tool === "Read" || tool === "Write" || tool === "Edit") {
        sourceOps++;
      }
    }
  }

  const totalFileOps = planningOps + sourceOps;
  const overheadRatio = totalFileOps > 0 ? planningOps / totalFileOps : 0;

  // Snapshot compliance: how many sessions start with gad snapshot?
  const sessionFirstCmds = {};
  for (const e of events) {
    if (!e.session_id) continue;
    if (!sessionFirstCmds[e.session_id] && e.gad_command?.startsWith("snapshot")) {
      sessionFirstCmds[e.session_id] = true;
    }
    if (!sessionFirstCmds[e.session_id]) {
      sessionFirstCmds[e.session_id] = false;
    }
  }
  const snapshotCompliance =
    sessions.size > 0
      ? Object.values(sessionFirstCmds).filter(Boolean).length / sessions.size
      : 0;

  // GAD CLI usage breakdown
  let snapshotCount = 0;
  let evalCount = 0;
  let otherGadCount = 0;
  for (const [cmd, count] of Object.entries(gadCmds)) {
    if (cmd.startsWith("snapshot")) snapshotCount += count;
    else if (cmd.startsWith("eval")) evalCount += count;
    else otherGadCount += count;
  }

  const days = Object.keys(byDay).sort();

  return {
    period: {
      start: days[0] || null,
      end: days[days.length - 1] || null,
      days: days.length,
    },
    totals: {
      events: events.length,
      sessions: sessions.size,
      gad_cli_calls: Object.values(gadCmds).reduce((a, b) => a + b, 0),
    },
    runtime_distribution: Object.entries(byRuntime)
      .sort((a, b) => b[1] - a[1])
      .map(([runtime, count]) => ({ runtime, count })),
    runtime_sessions: Object.entries(sessionsByRuntime)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([runtime, runtimeSessions]) => ({ runtime, sessions: runtimeSessions.size })),
    tool_distribution: Object.entries(byTool)
      .sort((a, b) => b[1] - a[1])
      .map(([tool, count]) => ({ tool, count })),
    per_day: Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count })),
    framework_overhead: {
      planning_ops: planningOps,
      source_ops: sourceOps,
      ratio: Math.round(overheadRatio * 1000) / 1000,
      score: overheadRatio < 0.15 ? 1.0 : overheadRatio < 0.25 ? 0.7 : overheadRatio < 0.4 ? 0.4 : 0.1,
    },
    loop_compliance: {
      snapshot_starts: Object.values(sessionFirstCmds).filter(Boolean).length,
      total_sessions: sessions.size,
      score: Math.round(snapshotCompliance * 100) / 100,
    },
    gad_cli_breakdown: {
      snapshot: snapshotCount,
      eval: evalCount,
      other: otherGadCount,
    },
    computed_at: new Date().toISOString(),
  };
}

/** Compute pressure per phase from TASK-REGISTRY.xml (gad-75/gad-79/gad-115) */
function computePhasesPressure() {
  const regFile = path.join(REPO_ROOT, ".planning", "TASK-REGISTRY.xml");
  if (!fs.existsSync(regFile)) return [];
  const content = fs.readFileSync(regFile, "utf8");

  // Parse phases and their tasks
  const phaseRe = /<phase id="([^"]*)">([\s\S]*?)<\/phase>/g;
  const phases = [];
  let m;

  while ((m = phaseRe.exec(content)) !== null) {
    const phaseId = m[1];
    const phaseBody = m[2];
    const tasks = [];
    let tm;
    const taskReLocal = /<task\s([^>]*)>([\s\S]*?)<\/task>/g;
    while ((tm = taskReLocal.exec(phaseBody)) !== null) {
      const attrs = tm[1];
      const statusMatch = attrs.match(/status="([^"]*)"/);
      const idMatch = attrs.match(/id="([^"]*)"/);
      const status = statusMatch ? statusMatch[1] : "planned";
      const id = idMatch ? idMatch[1] : "";
      const goalMatch = tm[2].match(/<goal>([\s\S]*?)<\/goal>/);
      const goal = goalMatch ? goalMatch[1].trim() : "";
      tasks.push({ id, status, goal });
    }

    const done = tasks.filter(t => t.status === "done").length;
    const total = tasks.length;
    // Configurable pressure formula (GAD-D-145): tasks_total + crosscuts * crosscut_weight
    // Shannon framing: tasks_total = raw phase entropy, crosscuts = mutual-information across subsystems
    const systems = CONFIG.crosscut_detection.systems;
    const minSystems = CONFIG.crosscut_detection.min_systems_to_count;
    const crosscutWeight = CONFIG.pressure.crosscut_weight;
    const threshold = CONFIG.pressure.high_pressure_threshold;

    const crosscuts = tasks.filter(t => {
      const words = t.goal.toLowerCase();
      return systems.filter(s => words.includes(s)).length >= minSystems;
    }).length;

    const pressure = total + (crosscuts * crosscutWeight);

    phases.push({
      phase: phaseId,
      tasks_total: total,
      tasks_done: done,
      crosscuts,
      pressure_score: pressure,
      high_pressure: pressure > threshold,
      tasks,
    });
  }

  return phases;
}

/** Look up phase title from ROADMAP.xml */
function lookupPhaseTitle(phaseId) {
  const roadmapFile = path.join(REPO_ROOT, ".planning", "ROADMAP.xml");
  if (!fs.existsSync(roadmapFile)) return "";
  const content = fs.readFileSync(roadmapFile, "utf8");
  const re = new RegExp(`<phase id="${phaseId}">[\\s\\S]*?<title>([\\s\\S]*?)<\\/title>`);
  const m = content.match(re);
  return m ? m[1].trim() : "";
}

/** Slugify for skill file names */
function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Read the reviewed field from an existing candidate SKILL.md (GAD-D-145) */
function readCandidateReviewed(skillFile) {
  if (!fs.existsSync(skillFile)) return { reviewed: false, reviewed_on: null, reviewed_notes: null };
  try {
    const content = fs.readFileSync(skillFile, "utf8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return { reviewed: false, reviewed_on: null, reviewed_notes: null };
    const fm = fmMatch[1];
    const reviewedMatch = fm.match(/^reviewed:\s*(.+)$/m);
    const reviewedOnMatch = fm.match(/^reviewed_on:\s*"?([^"\n]*)"?$/m);
    const reviewedNotesMatch = fm.match(/^reviewed_notes:\s*"?([^"\n]*)"?$/m);
    const raw = reviewedMatch ? reviewedMatch[1].trim() : "false";
    // `false` (literal) means unreviewed; anything else is a review verdict
    const reviewed = raw === "false" ? false : raw.replace(/^["']|["']$/g, "");
    return {
      reviewed,
      reviewed_on: reviewedOnMatch ? reviewedOnMatch[1].trim() : null,
      reviewed_notes: reviewedNotesMatch ? reviewedNotesMatch[1].trim() : null,
    };
  } catch {
    return { reviewed: false, reviewed_on: null, reviewed_notes: null };
  }
}

/** Generate SKILL.md draft content from phase data */
function generateCandidateDraft(phase, phaseTitle) {
  const date = new Date().toISOString().split("T")[0];
  const taskList = phase.tasks
    .filter(t => t.goal)
    .slice(0, 15)
    .map(t => `- **${t.id}** [${t.status}] ${t.goal.slice(0, 150)}${t.goal.length > 150 ? "..." : ""}`)
    .join("\n");

  const slug = slugify(phaseTitle) || `phase-${phase.phase}`;
  const name = `phase-${phase.phase}-${slug}`;
  const description = `Candidate skill auto-drafted from phase ${phase.phase} "${phaseTitle}" — pressure score ${phase.pressure_score} (${phase.tasks_total} tasks, ${phase.crosscuts} crosscuts). Review and promote, merge, or discard.`;

  const body = `---
name: ${name}
status: candidate
category: System
origin: auto-drafted
reviewed: false
reviewed_on: null
reviewed_notes: null
source_phase: "${phase.phase}"
source_phase_title: "${phaseTitle.replace(/"/g, '\\"')}"
pressure_score: ${phase.pressure_score}
tasks_total: ${phase.tasks_total}
crosscuts: ${phase.crosscuts}
drafted_on: "${date}"
description: >-
  ${description}
---

# Skill Candidate: phase-${phase.phase}

**This is an auto-drafted candidate, not a live skill.** It was generated because phase ${phase.phase} exceeded the pressure threshold (score ${phase.pressure_score}, threshold 10). High pressure signals that patterns likely exist in this phase that could become a reusable skill.

## Source phase

- **Phase:** ${phase.phase}
- **Title:** ${phaseTitle}
- **Pressure score:** ${phase.pressure_score}
- **Tasks:** ${phase.tasks_total} total (${phase.tasks_done} done)
- **Crosscuts:** ${phase.crosscuts} tasks touching multiple systems

## Observed task patterns

Review the tasks below for repeated command sequences, recurring agent decisions, or manual operations that could be automated:

${taskList || "_No task goals captured._"}

## Review checklist

Before promoting this candidate to a real skill, answer:

1. **What is the recurring pattern?** Describe the task shape in 1-2 sentences.
2. **When should an agent use this skill?** List concrete trigger conditions.
3. **What CLI commands does it chain?** Prefer CLI over manual file operations (decision GAD-D-99).
4. **Does it overlap with an existing skill?** If yes, use \`gad:merge-skill\` instead of promoting.
5. **Can it be tested?** A candidate without testable behavior should be discarded.

## Review actions

- **Promote** — move to \`.agents/skills/<final-name>/SKILL.md\`, remove \`status: candidate\`, scaffold eval project per GAD-D-102.
- **Merge** — combine with an existing skill via \`gad:merge-skill\`.
- **Discard** — delete the candidate file and log why in the skills changelog.

## How this was drafted

This file was auto-generated by \`site/scripts/compute-self-eval.mjs\` during the prebuild pipeline. The pressure score is computed from task count plus crosscut count per phase (decisions GAD-D-75, GAD-D-79, GAD-D-115). Candidates are quarantined from the live catalog (\`status: candidate\` frontmatter excludes them from catalog scans) so they don't pollute GAD until a human reviews them (decision GAD-D-144).
`;

  return { name, body };
}

/** Write skill candidates for high-pressure phases (GAD-D-144, GAD-D-145) */
function writeSkillCandidates(phasesPressure) {
  const candidatesDir = path.join(REPO_ROOT, "skills", "candidates");
  if (!fs.existsSync(candidatesDir)) {
    fs.mkdirSync(candidatesDir, { recursive: true });
  }

  const highPressure = phasesPressure.filter(p => p.high_pressure);
  const written = [];
  const skipped = [];
  const candidates = [];

  for (const phase of highPressure) {
    const title = lookupPhaseTitle(phase.phase);
    const { name, body } = generateCandidateDraft(phase, title);
    const skillDir = path.join(candidatesDir, name);
    const skillFile = path.join(skillDir, "SKILL.md");

    // Read review state from existing candidate (GAD-D-145)
    const reviewState = readCandidateReviewed(skillFile);

    // If already reviewed (promoted/merged/discarded), don't regenerate — keep the human's
    // review verdict sticky. Still surface it on the site with the reviewed state.
    if (reviewState.reviewed !== false) {
      skipped.push({ name, reviewed: reviewState.reviewed });
      const existingBody = fs.existsSync(skillFile) ? fs.readFileSync(skillFile, "utf8") : body;
      candidates.push({
        name,
        source_phase: phase.phase,
        source_phase_title: title,
        pressure_score: phase.pressure_score,
        tasks_total: phase.tasks_total,
        tasks_done: phase.tasks_done,
        crosscuts: phase.crosscuts,
        file_path: `skills/candidates/${name}/SKILL.md`,
        reviewed: reviewState.reviewed,
        reviewed_on: reviewState.reviewed_on,
        reviewed_notes: reviewState.reviewed_notes,
        body_raw: existingBody,
        body_html: renderMarkdown(existingBody),
        tasks: phase.tasks.filter(t => t.goal).map(t => ({ id: t.id, status: t.status, goal: t.goal })),
      });
      continue;
    }

    // Unreviewed candidate: write if changed
    fs.mkdirSync(skillDir, { recursive: true });
    let changed = true;
    if (fs.existsSync(skillFile)) {
      const existing = fs.readFileSync(skillFile, "utf8");
      changed = existing !== body;
    }
    if (changed) {
      fs.writeFileSync(skillFile, body);
      written.push(name);
    }
    candidates.push({
      name,
      source_phase: phase.phase,
      source_phase_title: title,
      pressure_score: phase.pressure_score,
      tasks_total: phase.tasks_total,
      tasks_done: phase.tasks_done,
      crosscuts: phase.crosscuts,
      file_path: `skills/candidates/${name}/SKILL.md`,
      reviewed: false,
      reviewed_on: null,
      reviewed_notes: null,
      body_raw: body,
      body_html: renderMarkdown(body),
      tasks: phase.tasks.filter(t => t.goal).map(t => ({ id: t.id, status: t.status, goal: t.goal })),
    });
  }

  if (written.length > 0) {
    console.log(`  [self-eval] Wrote/updated ${written.length} unreviewed skill candidate(s)`);
  }
  if (skipped.length > 0) {
    console.log(`  [self-eval] Skipped ${skipped.length} reviewed candidate(s): ${skipped.map(s => `${s.name}=${s.reviewed}`).join(", ")}`);
  }

  return candidates;
}

/** Count tasks from TASK-REGISTRY.xml across all workspaces */
function countTasks() {
  const result = { done: 0, planned: 0, in_progress: 0, total: 0 };
  // Check main project and all vendor workspaces
  const roots = [
    path.join(MONOREPO_ROOT, ".planning"),
    path.join(MONOREPO_ROOT, "vendor", "get-anything-done", ".planning"),
  ];
  for (const root of roots) {
    const regFile = path.join(root, "TASK-REGISTRY.xml");
    if (!fs.existsSync(regFile)) continue;
    const content = fs.readFileSync(regFile, "utf8");
    const doneMatches = content.match(/status="done"/g);
    const plannedMatches = content.match(/status="planned"/g);
    const progressMatches = content.match(/status="in-progress"/g);
    result.done += doneMatches?.length ?? 0;
    result.planned += plannedMatches?.length ?? 0;
    result.in_progress += progressMatches?.length ?? 0;
  }
  result.total = result.done + result.planned + result.in_progress;
  return result;
}

/** Count decisions from DECISIONS.xml */
function countDecisions() {
  const decFile = path.join(REPO_ROOT, ".planning", "DECISIONS.xml");
  if (!fs.existsSync(decFile)) return 0;
  const content = fs.readFileSync(decFile, "utf8");
  return (content.match(/<decision id="/g) || []).length;
}

const events = readAllEvents();
const metrics = computeMetrics(events);
const evalMetrics = computeEvalMetrics(readEvalTraces());
const projectTokenMetrics = computeProjectTokenMetrics(readProjectTraceEvents());

if (metrics) {
  // Add task and decision counts + per-phase pressure
  metrics.tasks = countTasks();
  metrics.decisions = countDecisions();
  metrics.phases_pressure = computePhasesPressure();
  const highPressure = metrics.phases_pressure.filter(p => p.high_pressure);
  if (highPressure.length > 0) {
    console.log(`  [self-eval] High-pressure phases (skill creation candidates): ${highPressure.map(p => p.phase).join(', ')}`);
  }

  // Write skill candidates for high-pressure phases (GAD-D-144)
  metrics.skill_candidates = writeSkillCandidates(metrics.phases_pressure);
  // Strip the heavy task data from phases_pressure in the persisted output (candidates already have it)
  metrics.phases_pressure = metrics.phases_pressure.map(({ tasks, ...rest }) => rest);
  metrics.evals = evalMetrics;
  metrics.project_tokens = {
    exact_eval_tokens: evalMetrics.tokens.total,
    estimated_live_input_tokens: projectTokenMetrics.estimated_input_tokens,
    estimated_live_output_tokens: projectTokenMetrics.estimated_output_tokens,
    estimated_live_total_tokens: projectTokenMetrics.estimated_total_tokens,
    combined_total_tokens: evalMetrics.tokens.total + projectTokenMetrics.estimated_total_tokens,
    trace_files: projectTokenMetrics.trace_files,
    trace_events: projectTokenMetrics.trace_events,
    runtime_distribution: projectTokenMetrics.runtime_distribution,
    sources: projectTokenMetrics.sources,
  };

  // Append-only: load existing snapshots, add new one (gad-103)
  let existing = { snapshots: [] };
  if (fs.existsSync(OUTPUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
      if (Array.isArray(prev.snapshots)) {
        existing = prev;
      } else {
        // Migrate from single-object format to snapshots array
        existing.snapshots = [prev];
      }
    } catch {}
  }

  // Deduplicate by period — replace if same period, append if new
  const idx = existing.snapshots.findIndex(
    (s) => s.period?.start === metrics.period.start && s.period?.end === metrics.period.end
  );
  if (idx >= 0) {
    existing.snapshots[idx] = metrics;
  } else {
    existing.snapshots.push(metrics);
  }

  // Keep latest snapshot at top level for easy access
  const output = {
    latest: metrics,
    snapshots: existing.snapshots,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(
    `  [self-eval] ${metrics.totals.events} events, ${metrics.tasks.total} tasks (${metrics.tasks.done} done), ${metrics.decisions} decisions → ${OUTPUT} (overhead: ${(metrics.framework_overhead.ratio * 100).toFixed(1)}%, loop compliance: ${(metrics.loop_compliance.score * 100).toFixed(0)}%)`
  );
} else {
  console.log("  [self-eval] no trace data found");
}
