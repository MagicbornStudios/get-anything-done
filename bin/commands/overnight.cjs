'use strict';
/**
 * gad overnight — autonomous overnight loop (Phase 159).
 *
 * Long-running daemon that ticks every N minutes and:
 *   1. Runs gad team-health; restarts any stalled workers
 *   2. Runs gad provenance build + export (keeps training corpus fresh)
 *   3. Sweeps phases for auto-close (any phase with all-tasks-done -> CLOSED)
 *   4. For phases with planned tasks but no active claimed handoff, creates
 *      a handoff so a worker picks it up
 *   5. Logs every tick to .planning/overnight.log
 *   6. Captures any stuck-decisions as operator todos so they're waiting
 *      in the morning
 *
 * Designed to be launched detached (nohup / start /b) so it survives the
 * operator's session ending. Killed by SIGINT/SIGTERM or `gad overnight stop`.
 *
 * Operator standing rule 2026-05-07: "i want you working and making sure we
 * are setup for success... periodically on a schedule check in and make
 * more handoffs if not and have opencode any runtime do it... when they
 * arent breaking, get past, then fix the break."
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { defineCommand } = require('citty');
const { writeSitrepDigest } = require('../../lib/sitrep-digest.cjs');

const DEFAULT_TICK_MINUTES = 30;
const PIDFILE_NAME = 'overnight.pid';
const LOGFILE_NAME = 'overnight.log';
const STATE_FILE_NAME = 'overnight-state.json';

// Module-scoped state for in-flight guard, mtime cache, stall counters.
// Reset on every daemon process start (intended).
const _runtime = {
  ticking: false,
  lastTraceMtimeByProject: Object.create(null),
  consecutiveStallByWorker: Object.create(null),
};

function ts() { return new Date().toISOString(); }

function gadCli() {
  return path.resolve(__dirname, '..', 'gad.cjs');
}

function logToFile(planningDir, message) {
  try {
    const logPath = path.join(planningDir, LOGFILE_NAME);
    fs.appendFileSync(logPath, `[${ts()}] ${message}\n`);
  } catch {}
}

function runGad(args, opts = {}) {
  return spawnSync('node', [gadCli(), ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    ...opts,
  });
}

function getProjects(deps) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  return {
    baseDir,
    projects: (config.roots || []).map((r) => ({
      projectId: r.id,
      rootPath: path.resolve(baseDir, r.path || '.'),
      planningDir: r.planningDir || '.planning',
    })),
  };
}

// ─── Tick steps ──────────────────────────────────────────────────────────

function stepHealth(planningDir, log) {
  const r = runGad(['team-health', '--only-bad', '--json']);
  if (r.status === 0) {
    // Reset all stall counters when everyone reports healthy.
    if (Object.keys(_runtime.consecutiveStallByWorker).length > 0) {
      _runtime.consecutiveStallByWorker = Object.create(null);
    }
    log('health: all workers healthy');
    return { healthy: true };
  }
  // Non-zero exit means stalled workers detected — require 2 consecutive
  // detections before restarting, to absorb transient false positives.
  let report = [];
  try { report = JSON.parse(r.stdout || '[]'); } catch {}
  let restarted = 0;
  const stillStalled = new Set();
  for (const projectReport of report) {
    for (const w of (projectReport.workers || [])) {
      if (w.health.verdict !== 'stalled') continue;
      const key = `${projectReport.project}/${w.id}`;
      stillStalled.add(key);
      const count = (_runtime.consecutiveStallByWorker[key] || 0) + 1;
      _runtime.consecutiveStallByWorker[key] = count;
      if (count < 2) {
        log(`health: ${key} stalled (${w.health.reason}) — strike ${count}/2, deferring restart`);
        continue;
      }
      log(`health: restarting stalled worker ${key} (${w.health.reason}) after ${count} strikes`);
      const rr = runGad(['team', 'restart', '--worker-id', w.id, '--projectid', projectReport.project]);
      if (rr.status === 0) {
        restarted++;
        delete _runtime.consecutiveStallByWorker[key];
      } else {
        log(`health: restart failed for ${w.id}: ${(rr.stderr || '').trim().slice(0, 200)}`);
      }
    }
  }
  // Clear counters for workers that recovered between ticks (in report but not stalled).
  for (const key of Object.keys(_runtime.consecutiveStallByWorker)) {
    if (!stillStalled.has(key)) delete _runtime.consecutiveStallByWorker[key];
  }
  log(`health: restarted ${restarted} worker(s)`);
  return { healthy: false, restarted };
}

// Probe per-project trace mtimes; return true if any project has a newer
// .trace-events.jsonl than the cached mtime, false if everything is unchanged.
// Updates the cache as a side effect when something is newer.
function tracesChangedSinceLastBuild(projects) {
  let changed = false;
  for (const p of projects) {
    const tracePath = path.join(p.rootPath, p.planningDir, '.trace-events.jsonl');
    let mtime = 0;
    try { mtime = fs.statSync(tracePath).mtimeMs; } catch { continue; }
    const last = _runtime.lastTraceMtimeByProject[p.projectId] || 0;
    if (mtime > last) {
      changed = true;
      _runtime.lastTraceMtimeByProject[p.projectId] = mtime;
    }
  }
  return changed;
}

function stepProvenance(projects, log) {
  if (!tracesChangedSinceLastBuild(projects)) {
    log('provenance: skipped — no new trace events since last build');
    return { ok: true, skipped: true };
  }
  log('provenance: building + exporting...');
  const r = runGad(['provenance', 'build', '--skip-survival', '--skip-frequency']);
  if (r.status !== 0) {
    log(`provenance: build failed (${r.status}): ${(r.stderr || '').trim().slice(0, 300)}`);
    return { ok: false };
  }
  const e = runGad(['provenance', 'export']);
  if (e.status !== 0) {
    log(`provenance: export failed (${e.status})`);
    return { ok: false };
  }
  log('provenance: build + export OK');
  return { ok: true };
}

function stepSweepPhases(projects, log, deadline) {
  let total = 0;
  for (const p of projects) {
    if (deadline && Date.now() > deadline) { log('sweep: budget reached — deferring remaining projects to next tick'); break; }
    const r = runGad(['phases', 'sweep', '--auto-close', '--projectid', p.projectId]);
    if (r.status === 0) {
      const closedCount = (r.stdout || '').match(/CLOSED/g);
      if (closedCount) total += closedCount.length;
    }
  }
  if (total > 0) log(`sweep: closed ${total} phase(s) auto-eligible`);
  return { closed: total };
}

function stepEnsureHandoffs(projects, log, deadline) {
  let created = 0;
  for (const p of projects) {
    if (deadline && Date.now() > deadline) { log('handoffs: budget reached — deferring remaining projects to next tick'); break; }
    // Get phases that are open with planned tasks
    const phasesResult = runGad(['phases', 'list', '--projectid', p.projectId, '--json']);
    if (phasesResult.status !== 0) continue;
    let phases = [];
    try { phases = JSON.parse(phasesResult.stdout || '[]'); } catch { continue; }

    // Check open handoffs to avoid duplicates
    const openHandoffs = path.join(p.rootPath, p.planningDir, 'handoffs', 'open');
    const existingPhases = new Set();
    if (fs.existsSync(openHandoffs)) {
      for (const f of fs.readdirSync(openHandoffs)) {
        const m = f.match(/^h-[\d-T]+-[a-z-]+-(\d+(?:\.\d+)?)/);
        if (m) existingPhases.add(m[1]);
      }
    }

    for (const phase of phases) {
      if (deadline && Date.now() > deadline) { log('handoffs: budget reached mid-project — deferring remaining phases to next tick'); break; }
      if (phase.status !== 'planned' && phase.status !== 'in-progress') continue;
      const phaseId = String(phase.id);
      if (existingPhases.has(phaseId)) continue;

      // Check if phase has planned tasks
      const tasksResult = runGad(['tasks', 'list', '--projectid', p.projectId, '--phase', phaseId, '--status', 'planned', '--json']);
      if (tasksResult.status !== 0) continue;
      let tasks = [];
      try { tasks = JSON.parse(tasksResult.stdout || '[]'); } catch { continue; }
      if (tasks.length === 0) continue;

      // Create a handoff
      const body = `Overnight autopilot handoff. Phase ${phaseId} has ${tasks.length} planned task(s). Pick the next, implement, stamp done, repeat. Refer to .planning/phases/${phaseId}-*/PLAN.md if present.`;
      const r = runGad(['handoffs', 'create', '--projectid', p.projectId, '--phase', phaseId, '--runtime-preference', 'opencode', '--body', body]);
      if (r.status === 0) { created++; log(`handoffs: created for ${p.projectId} phase ${phaseId} (${tasks.length} planned tasks)`); }
    }
  }
  if (created === 0) log('handoffs: nothing new to dispatch');
  return { created };
}

// ─── Main loop ──────────────────────────────────────────────────────────

async function runTick(deps, log) {
  if (_runtime.ticking) {
    log('--- tick skipped — previous tick still in progress ---');
    return;
  }
  _runtime.ticking = true;
  const t0 = Date.now();
  // Wall-clock budget so a single tick can't blow the desk-hook's 120s timeout
  // (overnight-tick.mjs) and trip its circuit breaker. The expensive steps
  // (sweep + ensure-handoffs) iterate every project × every planned phase with
  // a synchronous `gad` spawn each; on a many-phase repo that runs long. Work
  // is idempotent across ticks, so bailing early just defers to the next tick.
  const TICK_BUDGET_MS = 90_000;
  const deadline = t0 + TICK_BUDGET_MS;
  log('--- tick start ---');
  try {
    const { baseDir, projects } = getProjects(deps);
    try { stepHealth(null, log); } catch (e) { log(`health error: ${e.message}`); }
    try { stepProvenance(projects, log); } catch (e) { log(`provenance error: ${e.message}`); }
    try { stepSweepPhases(projects, log, deadline); } catch (e) { log(`sweep error: ${e.message}`); }
    try { stepEnsureHandoffs(projects, log, deadline); } catch (e) { log(`handoff error: ${e.message}`); }
    // Write SITREP digest for passive operator visibility (GLOBAL-D-315)
    try {
      const projectid = (projects[0] && projects[0].projectId) || 'global';
      writeSitrepDigest(baseDir, projectid);
      log('sitrep: digest written to .planning/.sitrep.md');
    } catch (e) { log(`sitrep error: ${e.message}`); }
  } finally {
    _runtime.ticking = false;
    log(`--- tick end (${((Date.now() - t0) / 1000).toFixed(1)}s) ---`);
  }
}

// Drop our own process to BELOW_NORMAL priority on supported platforms.
// Best-effort — silently no-op if the platform/runtime can't honor it.
function lowerOwnPriority(log) {
  try {
    const target = (os.constants && os.constants.priority && os.constants.priority.PRIORITY_BELOW_NORMAL);
    if (typeof target !== 'number') return;
    os.setPriority(target);
    log(`priority: lowered own process to BELOW_NORMAL (${target})`);
  } catch (e) {
    log(`priority: setPriority failed (${e.message}) — continuing at default`);
  }
}

function createOvernightCommand(deps) {
  const startCmd = defineCommand({
    meta: { name: 'start', description: 'Start the overnight autopilot loop (long-running, non-blocking). Hardened per phase 159: 30min default ticks, in-flight guard, BELOW_NORMAL Windows priority, skip-if-no-traces, 2-strike worker-stall before restart. Use --detach to fork into background. The MCP tool sweep_handoffs (phase 164) is the on-demand alternative when you want a one-shot pass instead of standing rotation.' },
    args: {
      'tick-minutes': { type: 'string', description: 'Tick interval in minutes', default: String(DEFAULT_TICK_MINUTES) },
      detach: { type: 'boolean', description: 'Fork into background', default: false },
      'max-ticks': { type: 'string', description: 'Stop after N ticks (default: forever)', default: '0' },
    },
    async run({ args }) {
      const { baseDir } = getProjects(deps);
      const planningDir = path.join(baseDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });

      if (args.detach) {
        // Re-spawn ourselves detached
        const child = spawn('node', [gadCli(), 'overnight', 'start', '--tick-minutes', args['tick-minutes']], {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env, GAD_OVERNIGHT_CHILD: '1' },
          windowsHide: true,
        });
        child.unref();
        // Write pidfile
        fs.writeFileSync(path.join(planningDir, PIDFILE_NAME), String(child.pid));
        console.log(`overnight detached (pid ${child.pid}). log: ${path.relative(process.cwd(), path.join(planningDir, LOGFILE_NAME))}`);
        return;
      }

      // Foreground / detached child path
      const tickMs = (parseFloat(args['tick-minutes']) || DEFAULT_TICK_MINUTES) * 60_000;
      const maxTicks = parseInt(args['max-ticks'], 10) || 0;
      const log = (m) => {
        logToFile(planningDir, m);
        if (!process.env.GAD_OVERNIGHT_CHILD) console.log(`[overnight] ${m}`);
      };

      log(`overnight starting. tick=${tickMs / 1000}s pid=${process.pid}`);
      lowerOwnPriority(log);
      // Always write pidfile (covers both foreground and detached-child paths)
      fs.writeFileSync(path.join(planningDir, PIDFILE_NAME), String(process.pid));

      let tickCount = 0;
      const tick = async () => {
        tickCount++;
        try { await runTick(deps, log); }
        catch (e) { log(`tick fatal: ${e.message}`); }
        if (maxTicks > 0 && tickCount >= maxTicks) {
          log(`reached max-ticks ${maxTicks}; exiting.`);
          try { fs.unlinkSync(path.join(planningDir, PIDFILE_NAME)); } catch {}
          process.exit(0);
        }
      };

      // Initial tick immediately, then schedule
      await tick();
      const interval = setInterval(tick, tickMs);

      const cleanup = () => {
        log(`overnight stopping (signal). pid=${process.pid}`);
        clearInterval(interval);
        try { fs.unlinkSync(path.join(planningDir, PIDFILE_NAME)); } catch {}
        process.exit(0);
      };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      // Keep alive
      setInterval(() => {}, 1 << 30);
    },
  });

  const stopCmd = defineCommand({
    meta: { name: 'stop', description: 'Stop the running overnight daemon (reads pid from .planning/overnight.pid)' },
    args: {},
    run() {
      const { baseDir } = getProjects(deps);
      const pidfile = path.join(baseDir, '.planning', PIDFILE_NAME);
      if (!fs.existsSync(pidfile)) { console.log('No overnight pidfile.'); return; }
      const pid = parseInt(fs.readFileSync(pidfile, 'utf8'), 10);
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`Sent SIGTERM to overnight pid ${pid}`);
      } catch (e) {
        console.log(`Process ${pid} not running (stale pidfile cleaned)`);
        try { fs.unlinkSync(pidfile); } catch {}
      }
    },
  });

  const statusCmd = defineCommand({
    meta: { name: 'status', description: 'Show overnight daemon status + recent log lines' },
    args: { lines: { type: 'string', default: '20' } },
    run({ args }) {
      const { baseDir } = getProjects(deps);
      const planningDir = path.join(baseDir, '.planning');
      const pidfile = path.join(planningDir, PIDFILE_NAME);
      const logfile = path.join(planningDir, LOGFILE_NAME);
      if (fs.existsSync(pidfile)) {
        const pid = parseInt(fs.readFileSync(pidfile, 'utf8'), 10);
        let alive = false;
        try { process.kill(pid, 0); alive = true; } catch {}
        console.log(`pid ${pid} ${alive ? 'RUNNING' : 'STALE'}`);
      } else {
        console.log('not running');
      }
      if (fs.existsSync(logfile)) {
        const all = fs.readFileSync(logfile, 'utf8').trim().split('\n');
        const tail = all.slice(-Math.max(1, parseInt(args.lines, 10) || 20));
        console.log('\nrecent log:');
        for (const line of tail) console.log('  ' + line);
      }
    },
  });

  const tickCmd = defineCommand({
    meta: { name: 'tick', description: 'Run a single tick now (one-shot, useful for cron / testing). Equivalent to one iteration of `gad overnight start`. The MCP tool sweep_handoffs is the chat-callable equivalent.' },
    args: {},
    async run() {
      const { baseDir } = getProjects(deps);
      const planningDir = path.join(baseDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      const log = (m) => { logToFile(planningDir, m); console.log(`[overnight] ${m}`); };
      await runTick(deps, log);
    },
  });

  return defineCommand({
    meta: {
      name: 'overnight',
      description: 'Autonomous overnight loop — health + provenance + phase sweep + handoff dispatch on a schedule. Survives session end via --detach.',
    },
    subCommands: {
      start: startCmd,
      stop: stopCmd,
      status: statusCmd,
      tick: tickCmd,
    },
  });
}

module.exports = { createOvernightCommand };
module.exports.register = (ctx) => ({ overnight: createOvernightCommand(ctx.common) });
