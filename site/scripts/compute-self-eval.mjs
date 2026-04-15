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
import { createRequire } from "node:module";

marked.setOptions({ gfm: true, breaks: false });
function renderMarkdown(src) {
  if (!src) return "";
  try { return marked.parse(src, { async: false }); }
  catch { return `<pre>${src.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>`; }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { readTasks } = require("../../lib/task-registry-reader.cjs");
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
const GAD_ROOT = { id: "get-anything-done", path: ".", planningDir: ".planning" };

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

function extractSnapshotProjectId(event) {
  const args = Array.isArray(event?.args) ? event.args : [];
  const idx = args.indexOf('--projectid');
  if (idx !== -1 && args[idx + 1]) return String(args[idx + 1]);
  const cmd = typeof event?.cmd === 'string' ? event.cmd : '';
  const match = cmd.match(/snapshot\s+--projectid\s+([A-Za-z0-9._/-]+)/);
  return match ? match[1] : null;
}

function estimateSnapshotTokensByProject(projectId) {
  try {
    const { execFileSync } = require('node:child_process');
    const output = execFileSync(
      process.execPath,
      [path.join(REPO_ROOT, 'bin', 'gad.cjs'), 'snapshot', '--projectid', projectId],
      { cwd: MONOREPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return estimateTokensFromText(output);
  } catch {
    return 0;
  }
}

function computeFrameworkCompliance() {
  const tasks = readTasks(GAD_ROOT, REPO_ROOT, {});
  const completed = tasks.filter((task) => task.status === 'done');
  const withSkill = completed.filter((task) => Boolean(task.skill)).length;
  const withAgent = completed.filter((task) => Boolean(task.agentId)).length;
  const withType = completed.filter((task) => Boolean(task.type)).length;
  const fullyAttributed = completed.filter((task) => Boolean(task.skill) && Boolean(task.agentId) && Boolean(task.type)).length;
  const total = completed.length;

  return {
    completed_tasks: total,
    with_skill: withSkill,
    with_agent: withAgent,
    with_type: withType,
    fully_attributed: fullyAttributed,
    score: total > 0 ? Math.round((fullyAttributed / total) * 1000) / 1000 : 0,
  };
}

function computeHydrationMetrics(events) {
  const snapshotEvents = events.filter((event) =>
    typeof event?.cmd === 'string' &&
    event.cmd.startsWith('snapshot') &&
    (event.exit == null || event.exit === 0)
  );

  const countsByProject = {};
  for (const event of snapshotEvents) {
    const projectId = extractSnapshotProjectId(event) || 'unknown';
    incrementCounter(countsByProject, projectId);
  }

  const estimatedTokensByProject = {};
  for (const projectId of Object.keys(countsByProject)) {
    estimatedTokensByProject[projectId] = estimateSnapshotTokensByProject(projectId);
  }

  const totalEstimatedTokens = Object.entries(countsByProject).reduce(
    (sum, [projectId, count]) => sum + ((estimatedTokensByProject[projectId] || 0) * count),
    0
  );

  return {
    snapshot_count: snapshotEvents.length,
    estimated_snapshot_tokens: totalEstimatedTokens,
    projects: Object.entries(countsByProject)
      .sort((a, b) => b[1] - a[1])
      .map(([project, count]) => ({
        project,
        count,
        estimated_tokens_per_snapshot: estimatedTokensByProject[project] || 0,
        estimated_total_tokens: (estimatedTokensByProject[project] || 0) * count,
      })),
  };
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

function computeActiveAssignments() {
  const lanesFile = path.join(REPO_ROOT, ".planning", ".gad-agent-lanes.json");
  const tasks = readTasks(GAD_ROOT, REPO_ROOT, {});
  if (!fs.existsSync(lanesFile)) {
    return {
      total_active_agents: 0,
      total_stale_agents: 0,
      total_claimed_tasks: tasks.filter((task) => task.agentId && task.status !== "done").length,
      runtime_distribution: [],
      depth_distribution: [],
      active_agents: [],
      stale_agents: [],
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(lanesFile, "utf8"));
  } catch {
    parsed = null;
  }

  const agents = Array.isArray(parsed?.agents) ? parsed.agents : [];
  const now = Date.now();
  const runtimeCounts = {};
  const depthCounts = {};
  const activeAgents = [];
  const staleAgents = [];

  for (const rawAgent of agents) {
    if (rawAgent?.status === "released") continue;
    const claimedTaskIds = Array.isArray(rawAgent?.claimedTaskIds) ? rawAgent.claimedTaskIds.map(String) : [];
    const inferredTaskIds = tasks
      .filter((task) => task.agentId === rawAgent.agentId && task.status !== "done")
      .map((task) => task.id);
    const taskIds = Array.from(new Set([...claimedTaskIds, ...inferredTaskIds]));
    const leaseExpiry = rawAgent?.leaseExpiresAt ? Date.parse(rawAgent.leaseExpiresAt) : Number.NaN;
    const lastSeen = rawAgent?.lastSeenAt ? Date.parse(rawAgent.lastSeenAt) : Number.NaN;
    const stale = Number.isFinite(leaseExpiry)
      ? leaseExpiry <= now
      : Number.isFinite(lastSeen) && lastSeen > 0 && (now - lastSeen) > 30 * 60 * 1000;

    const lane = {
      agent_id: rawAgent?.agentId || "unknown",
      agent_role: rawAgent?.agentRole || "default",
      runtime: rawAgent?.runtime || "unknown",
      depth: Number(rawAgent?.depth) || 0,
      parent_agent_id: rawAgent?.parentAgentId || null,
      root_agent_id: rawAgent?.rootAgentId || rawAgent?.agentId || null,
      model_profile: rawAgent?.modelProfile || null,
      resolved_model: rawAgent?.resolvedModel || null,
      tasks: taskIds,
      last_seen_at: rawAgent?.lastSeenAt || null,
      status: rawAgent?.status || "active",
    };

    incrementCounter(runtimeCounts, lane.runtime);
    incrementCounter(depthCounts, String(lane.depth));
    (stale ? staleAgents : activeAgents).push(lane);
  }

  return {
    total_active_agents: activeAgents.length,
    total_stale_agents: staleAgents.length,
    total_claimed_tasks: tasks.filter((task) => task.agentId && task.status !== "done").length,
    runtime_distribution: Object.entries(runtimeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([runtime, count]) => ({ runtime, count })),
    depth_distribution: Object.entries(depthCounts)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([depth, count]) => ({ depth: Number(depth), count })),
    active_agents: activeAgents.sort((a, b) => (b.tasks.length - a.tasks.length) || a.agent_id.localeCompare(b.agent_id)),
    stale_agents: staleAgents.sort((a, b) => (b.tasks.length - a.tasks.length) || a.agent_id.localeCompare(b.agent_id)),
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

/** Generate the new CANDIDATE.md format — raw phase dump, drafter discovers the rest. */
function generateCandidateMd(phase, phaseTitle) {
  const date = new Date().toISOString().split("T")[0];
  const taskList = phase.tasks
    .filter(t => t.goal)
    .map(t => `${t.id} ${t.status} ${t.goal}`)
    .join("\n");

  const slug = slugify(phaseTitle) || `phase-${phase.phase}`;
  const name = `phase-${phase.phase}-${slug}`;

  const body = `---
status: candidate
source_phase: "${phase.phase}"
source_phase_title: "${phaseTitle.replace(/"/g, '\\"')}"
pressure_score: ${phase.pressure_score}
tasks_total: ${phase.tasks_total}
tasks_done: ${phase.tasks_done}
crosscuts: ${phase.crosscuts}
created_on: "${date}"
created_by: compute-self-eval
---

# Candidate from phase ${phase.phase}

## Phase

\`\`\`
get-anything-done | ${phase.phase} | ${phaseTitle}
selection pressure: ${phase.pressure_score}  (${phase.tasks_total} tasks, ${phase.tasks_done} done, ${phase.crosscuts} crosscuts)
\`\`\`

## Tasks

\`\`\`
${taskList || "(no tasks captured)"}
\`\`\`

## What this candidate is for

This file was auto-generated by \`compute-self-eval.mjs\` because phase
${phase.phase} exceeded the selection pressure threshold. High pressure
signals a recurring pattern that may want to become a reusable skill.

This is the **raw input** to the drafting step. The drafter (\`create-proto-skill\`,
invoked by \`gad-evolution-evolve\`) reads this file and decides what the
skill should be. No curator pre-digestion happens — see the 2026-04-13
evolution-loop experiment finding for why
(\`evals/FINDINGS-2026-04-13-evolution-loop-experiment.md\`).

## How the drafter should enrich this

The drafter should pull additional context from:

- \`gad decisions --projectid get-anything-done | grep -i <keyword>\` —
  relevant decisions for this phase
- \`git log --follow --oneline <file>\` — historical context for files this
  phase touched (catches the "three attempts at task X failed" thread that
  lives in commit history)
- \`gad --help\` and \`gad <subcommand> --help\` — CLI surface available
  to the skill
- \`ls vendor/get-anything-done/skills/\` — existing skills to avoid
  duplicating

The drafter does **not** ask a human for anything. Make decisions and
document them in the SKILL.md.

## Output location

The drafter writes to \`.planning/proto-skills/${name}/SKILL.md\` — a
**different directory** from this candidate. Candidates and proto-skills
are two distinct stages:

- **candidate** (this file) = raw selection-pressure output
- **proto-skill** (drafter output) = drafted SKILL.md awaiting human review
- **skill** (post-promote) = lives in \`skills/\` as part of species DNA

The human reviewer runs \`gad evolution promote <slug>\` or
\`gad evolution discard <slug>\` after reviewing the proto-skill.
`;

  return { name, body };
}

/** Write candidates for high-pressure phases — new pipeline:
 *  - Writes raw CANDIDATE.md (not a SKILL.md stub)
 *  - Skips writing if a proto-skill already exists for this slug
 *    (the drafter has run; don't churn the candidate)
 *  - Skips writing if the candidate file already exists with the same body
 *  - Decision: see 2026-04-13 evolution-loop finding for why we stopped
 *    pre-digesting context. Drafter discovers what it needs.
 */
function writeCandidates(phasesPressure) {
  const candidatesDir = path.join(REPO_ROOT, "skills", "candidates");
  const protoSkillsDir = path.join(REPO_ROOT, ".planning", "proto-skills");
  const shedDir = path.join(REPO_ROOT, "skills", ".shed");
  if (!fs.existsSync(candidatesDir)) {
    fs.mkdirSync(candidatesDir, { recursive: true });
  }

  // Shed list — slugs the operator has explicitly dismissed via
  // `gad evolution shed <slug>`. Self-eval must NOT regenerate these.
  // Each file at skills/.shed/<slug> is a one-line reason log.
  const shedList = new Set();
  if (fs.existsSync(shedDir)) {
    for (const name of fs.readdirSync(shedDir)) {
      if (!name.startsWith(".")) shedList.add(name);
    }
  }

  const highPressure = phasesPressure.filter(p => p.high_pressure);
  const written = [];
  const skippedProto = [];
  const skippedShed = [];
  const candidates = [];

  for (const phase of highPressure) {
    const title = lookupPhaseTitle(phase.phase);
    const { name, body } = generateCandidateMd(phase, title);
    const candidateDir = path.join(candidatesDir, name);
    const candidateFile = path.join(candidateDir, "CANDIDATE.md");
    const protoSkillDir = path.join(protoSkillsDir, name);

    // Shed list — operator dismissed this slug. Don't regenerate.
    if (shedList.has(name)) {
      skippedShed.push(name);
      continue;
    }

    // If a proto-skill already exists for this slug, the drafter has run.
    // Don't regenerate the candidate — let the human review the proto-skill.
    if (fs.existsSync(protoSkillDir)) {
      skippedProto.push(name);
      candidates.push({
        name,
        source_phase: phase.phase,
        source_phase_title: title,
        pressure_score: phase.pressure_score,
        tasks_total: phase.tasks_total,
        tasks_done: phase.tasks_done,
        crosscuts: phase.crosscuts,
        candidate_file: `skills/candidates/${name}/CANDIDATE.md`,
        proto_skill_dir: `.planning/proto-skills/${name}/`,
        stage: "drafted",
        // Legacy fields for backwards compat with existing detail page
        file_path: `skills/candidates/${name}/CANDIDATE.md`,
        reviewed: false,
        reviewed_on: null,
        reviewed_notes: null,
        body_raw: fs.existsSync(candidateFile) ? fs.readFileSync(candidateFile, "utf8") : body,
        body_html: renderMarkdown(fs.existsSync(candidateFile) ? fs.readFileSync(candidateFile, "utf8") : body),
        tasks: phase.tasks.filter(t => t.goal).map(t => ({ id: t.id, status: t.status, goal: t.goal })),
      });
      continue;
    }

    fs.mkdirSync(candidateDir, { recursive: true });
    let changed = true;
    if (fs.existsSync(candidateFile)) {
      const existing = fs.readFileSync(candidateFile, "utf8");
      changed = existing !== body;
    }
    if (changed) {
      fs.writeFileSync(candidateFile, body);
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
      candidate_file: `skills/candidates/${name}/CANDIDATE.md`,
      proto_skill_dir: null,
      stage: "candidate",
      // Legacy fields for backwards compat with existing detail page
      file_path: `skills/candidates/${name}/CANDIDATE.md`,
      reviewed: false,
      reviewed_on: null,
      reviewed_notes: null,
      body_raw: body,
      body_html: renderMarkdown(body),
      tasks: phase.tasks.filter(t => t.goal).map(t => ({ id: t.id, status: t.status, goal: t.goal })),
    });
  }

  if (written.length > 0) {
    console.log(`  [self-eval] Wrote/updated ${written.length} candidate file(s) (CANDIDATE.md)`);
  }
  if (skippedProto.length > 0) {
    console.log(`  [self-eval] Skipped ${skippedProto.length} candidate(s) with existing proto-skill: ${skippedProto.join(", ")}`);
  }
  if (skippedShed.length > 0) {
    console.log(`  [self-eval] Skipped ${skippedShed.length} shed candidate(s): ${skippedShed.join(", ")}`);
  }

  return candidates;
}

/** Count tasks from TASK-REGISTRY.xml across the tracked planning roots */
function countTasks() {
  const result = { done: 0, planned: 0, in_progress: 0, total: 0 };
  // Check the main project and the GAD framework planning root
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
const frameworkCompliance = computeFrameworkCompliance();
const hydrationMetrics = computeHydrationMetrics(events);

if (metrics) {
  // Add task and decision counts + per-phase pressure
  metrics.tasks = countTasks();
  metrics.decisions = countDecisions();
  metrics.phases_pressure = computePhasesPressure();
  const highPressure = metrics.phases_pressure.filter(p => p.high_pressure);
  if (highPressure.length > 0) {
    console.log(`  [self-eval] High-pressure phases (skill creation candidates): ${highPressure.map(p => p.phase).join(', ')}`);
  }

  // Write candidates for high-pressure phases (phase 42 — new pipeline:
  // candidates are raw CANDIDATE.md, drafted to proto-skills by create-proto-skill)
  metrics.skill_candidates = writeCandidates(metrics.phases_pressure);
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
  const hydrationTotalBase = metrics.project_tokens.combined_total_tokens || 0;
  // Decision gad-173: `framework_compliance` upgraded to `workflow_conformance`.
  // The v1 metric is still the presence-based attribution score from
  // computeFrameworkCompliance; once trace-to-workflow synthesis (42.3-04)
  // computes real conformance scores, this becomes an aggregate over those.
  // Old name retained as a deprecated alias for one version so any existing
  // dashboard/link keeps working until it's updated.
  metrics.workflow_conformance = frameworkCompliance;
  metrics.framework_compliance = frameworkCompliance; // deprecated alias
  metrics.hydration = {
    ...hydrationMetrics,
    total_project_tokens: hydrationTotalBase,
    overhead_ratio: hydrationTotalBase > 0 ? Math.round((hydrationMetrics.estimated_snapshot_tokens / hydrationTotalBase) * 1000) / 1000 : 0,
  };
  metrics.active_assignments = computeActiveAssignments();

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
    `  [self-eval] ${metrics.totals.events} events, ${metrics.tasks.total} tasks (${metrics.tasks.done} done), ${metrics.decisions} decisions → ${OUTPUT} (overhead: ${(metrics.framework_overhead.ratio * 100).toFixed(1)}%, workflow conformance: ${(metrics.workflow_conformance.score * 100).toFixed(0)}%, hydration: ${(metrics.hydration.overhead_ratio * 100).toFixed(1)}%)`
  );
} else {
  console.log("  [self-eval] no trace data found");
}

