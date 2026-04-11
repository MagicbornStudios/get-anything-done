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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SITE_ROOT, "..");
const MONOREPO_ROOT = path.resolve(REPO_ROOT, "..", "..");
const LOG_DIR = path.join(MONOREPO_ROOT, ".planning", ".gad-log");
const OUTPUT = path.join(SITE_ROOT, "data", "self-eval.json");

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

function computeMetrics(events) {
  if (events.length === 0) return null;

  // Tool distribution
  const byTool = {};
  const byDay = {};
  const gadCmds = {};
  const sessions = new Set();
  let planningOps = 0;
  let sourceOps = 0;

  for (const e of events) {
    const tool = e.tool || "unknown";
    byTool[tool] = (byTool[tool] || 0) + 1;

    const day = e.ts?.slice(0, 10) || "unknown";
    byDay[day] = (byDay[day] || 0) + 1;

    if (e.session_id) sessions.add(e.session_id);
    if (e.gad_command) gadCmds[e.gad_command] = (gadCmds[e.gad_command] || 0) + 1;

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
  const taskRe = /<task\s[^>]*>([\s\S]*?)<\/task>/g;
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
      const status = statusMatch ? statusMatch[1] : "planned";
      const goalMatch = tm[2].match(/<goal>([\s\S]*?)<\/goal>/);
      const goal = goalMatch ? goalMatch[1].trim() : "";
      tasks.push({ status, goal });
    }

    const done = tasks.filter(t => t.status === "done").length;
    const total = tasks.length;
    // Simple pressure: task count * crosscut estimate (goals mentioning multiple systems)
    const crosscuts = tasks.filter(t => {
      const words = t.goal.toLowerCase();
      const systems = ["cli", "site", "eval", "skill", "agent", "trace", "hook", "planning", "state", "decision"];
      return systems.filter(s => words.includes(s)).length >= 2;
    }).length;

    const pressure = total + (crosscuts * 2); // tasks + weighted crosscuts

    phases.push({
      phase: phaseId,
      tasks_total: total,
      tasks_done: done,
      crosscuts,
      pressure_score: pressure,
      high_pressure: pressure > 10, // flag for skill creation review
    });
  }

  return phases;
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

if (metrics) {
  // Add task and decision counts + per-phase pressure
  metrics.tasks = countTasks();
  metrics.decisions = countDecisions();
  metrics.phases_pressure = computePhasesPressure();
  const highPressure = metrics.phases_pressure.filter(p => p.high_pressure);
  if (highPressure.length > 0) {
    console.log(`  [self-eval] High-pressure phases (skill creation candidates): ${highPressure.map(p => p.phase).join(', ')}`);
  }

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
