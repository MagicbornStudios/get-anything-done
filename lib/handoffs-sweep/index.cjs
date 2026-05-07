'use strict';
/**
 * lib/handoffs-sweep/index.cjs — on-demand handoff sweep (Phase 164).
 *
 * Exposes the same four steps as the overnight daemon's runTick() body as a
 * callable function: health check/restart, provenance build+export, phase
 * auto-close, and handoff creation for planned-but-unclaimed phases.
 *
 * Designed to be invoked by the MCP tool `sweep_handoffs` so that the
 * operator (or Claude) can trigger a sweep from chat without running a
 * standing daemon process.
 *
 * Module-scoped _runtime state is preserved across calls in the same process
 * (same semantics as the daemon's in-flight guard + mtime cache + stall
 * counters). This means repeated MCP tool invocations within one MCP server
 * session respect the 2-strike restart rule and skip redundant provenance
 * builds correctly.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// ─── Module-scoped runtime state ─────────────────────────────────────────────
// Preserved across repeated calls in the same process — intentional.

const _runtime = {
  /** Guard: prevents concurrent overlapping sweeps. */
  sweeping: false,
  /** Per-project trace mtime cache — skips provenance build if unchanged. */
  lastTraceMtimeByProject: Object.create(null),
  /** Strike counter for stalled workers — restart only after 2 consecutive detections. */
  consecutiveStallByWorker: Object.create(null),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gadCli() {
  return path.resolve(__dirname, '..', '..', 'bin', 'gad.cjs');
}

function runGad(args) {
  return spawnSync('node', [gadCli(), ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function ts() { return new Date().toISOString(); }

// ─── Step: health ─────────────────────────────────────────────────────────────

/**
 * Check team-health; restart stalled workers after 2 consecutive strikes.
 * @param {(msg: string) => void} log
 * @param {{ dry_run?: boolean }} opts
 * @returns {{ healthy: boolean, restarted?: number, would_restart?: string[] }}
 */
function stepHealth(log, opts = {}) {
  const r = runGad(['team-health', '--only-bad', '--json']);
  if (r.status === 0) {
    if (Object.keys(_runtime.consecutiveStallByWorker).length > 0) {
      _runtime.consecutiveStallByWorker = Object.create(null);
    }
    log('health: all workers healthy');
    return { healthy: true };
  }

  let report = [];
  try { report = JSON.parse(r.stdout || '[]'); } catch {}

  let restarted = 0;
  const wouldRestart = [];
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

      if (opts.dry_run) {
        wouldRestart.push(key);
        log(`health: [dry_run] would restart stalled worker ${key} (${w.health.reason}) after ${count} strikes`);
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

  // Clear counters for workers that recovered between calls.
  for (const key of Object.keys(_runtime.consecutiveStallByWorker)) {
    if (!stillStalled.has(key)) delete _runtime.consecutiveStallByWorker[key];
  }

  if (opts.dry_run) {
    log(`health: [dry_run] would restart ${wouldRestart.length} worker(s)`);
    return { healthy: false, would_restart: wouldRestart };
  }

  log(`health: restarted ${restarted} worker(s)`);
  return { healthy: false, restarted };
}

// ─── Step: provenance ─────────────────────────────────────────────────────────

/**
 * Return true if any project has a newer .trace-events.jsonl than our cached
 * mtime. Updates the cache as a side effect when something is newer.
 */
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

/**
 * Build + export provenance if trace events changed since last build.
 * @param {Array<{projectId, rootPath, planningDir}>} projects
 * @param {(msg: string) => void} log
 * @param {{ dry_run?: boolean }} opts
 * @returns {{ ok: boolean, skipped?: boolean }}
 */
function stepProvenance(projects, log, opts = {}) {
  if (!tracesChangedSinceLastBuild(projects)) {
    log('provenance: skipped — no new trace events since last build');
    return { ok: true, skipped: true };
  }
  if (opts.dry_run) {
    log('provenance: [dry_run] would build + export (new traces detected)');
    return { ok: true, would_build: true };
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

// ─── Step: sweep phases ───────────────────────────────────────────────────────

/**
 * Auto-close phases where all tasks are done.
 * @param {Array<{projectId, rootPath, planningDir}>} projects
 * @param {(msg: string) => void} log
 * @param {{ dry_run?: boolean }} opts
 * @returns {{ closed: number }}
 */
function stepSweepPhases(projects, log, opts = {}) {
  let total = 0;
  for (const p of projects) {
    const args = ['phases', 'sweep', '--auto-close', '--projectid', p.projectId];
    if (opts.dry_run) args.push('--dry-run');
    const r = runGad(args);
    if (r.status === 0) {
      const closedCount = (r.stdout || '').match(/CLOSED/g);
      if (closedCount) total += closedCount.length;
    }
  }
  const label = opts.dry_run ? '[dry_run] would close' : 'closed';
  if (total > 0) log(`sweep: ${label} ${total} phase(s) auto-eligible`);
  return { closed: total };
}

// ─── Step: ensure handoffs ────────────────────────────────────────────────────

/**
 * Create handoffs for phases with planned tasks that have no open handoff.
 * @param {Array<{projectId, rootPath, planningDir}>} projects
 * @param {(msg: string) => void} log
 * @param {{ dry_run?: boolean }} opts
 * @returns {{ created: number }}
 */
function stepEnsureHandoffs(projects, log, opts = {}) {
  let created = 0;
  for (const p of projects) {
    const phasesResult = runGad(['phases', 'list', '--projectid', p.projectId, '--json']);
    if (phasesResult.status !== 0) continue;
    let phases = [];
    try { phases = JSON.parse(phasesResult.stdout || '[]'); } catch { continue; }

    const openHandoffs = path.join(p.rootPath, p.planningDir, 'handoffs', 'open');
    const existingPhases = new Set();
    if (fs.existsSync(openHandoffs)) {
      for (const f of fs.readdirSync(openHandoffs)) {
        const m = f.match(/^h-[\d-T]+-[a-z-]+-(\d+(?:\.\d+)?)/);
        if (m) existingPhases.add(m[1]);
      }
    }

    for (const phase of phases) {
      if (phase.status !== 'planned' && phase.status !== 'in-progress') continue;
      const phaseId = String(phase.id);
      if (existingPhases.has(phaseId)) continue;

      const tasksResult = runGad(['tasks', 'list', '--projectid', p.projectId, '--phase', phaseId, '--status', 'planned', '--json']);
      if (tasksResult.status !== 0) continue;
      let tasks = [];
      try { tasks = JSON.parse(tasksResult.stdout || '[]'); } catch { continue; }
      if (tasks.length === 0) continue;

      if (opts.dry_run) {
        log(`handoffs: [dry_run] would create for ${p.projectId} phase ${phaseId} (${tasks.length} planned tasks)`);
        created++;
        continue;
      }

      const body = `On-demand sweep handoff. Phase ${phaseId} has ${tasks.length} planned task(s). Pick the next, implement, stamp done, repeat. Refer to .planning/phases/${phaseId}-*/PLAN.md if present.`;
      const r = runGad(['handoffs', 'create', '--projectid', p.projectId, '--phase', phaseId, '--runtime-preference', 'opencode', '--body', body]);
      if (r.status === 0) {
        created++;
        log(`handoffs: created for ${p.projectId} phase ${phaseId} (${tasks.length} planned tasks)`);
      }
    }
  }
  if (created === 0) log('handoffs: nothing new to dispatch');
  return { created };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the handoff sweep cycle on demand.
 *
 * @param {object} params
 * @param {object} params.deps           - GAD deps object (must provide findRepoRoot + gadConfig)
 * @param {(msg: string) => void} params.log - Log sink
 * @param {string[]} [params.projects]   - Optional array of projectIds to restrict to
 * @param {object} [params.options]      - Step-skip + dry_run flags
 * @param {boolean} [params.options.skip_health]
 * @param {boolean} [params.options.skip_provenance]
 * @param {boolean} [params.options.skip_sweep]
 * @param {boolean} [params.options.skip_handoffs]
 * @param {boolean} [params.options.dry_run]
 *
 * @returns {Promise<{ok: boolean, ts: string, health: object, provenance: object, sweep: object, handoffs: object}>}
 */
async function runSweep({ deps, log, projects: projectFilter, options = {} }) {
  if (_runtime.sweeping) {
    const msg = 'sweep skipped — previous sweep still in progress';
    log(msg);
    return { ok: false, ts: ts(), skipped: true, reason: msg, health: {}, provenance: {}, sweep: {}, handoffs: {} };
  }

  _runtime.sweeping = true;
  const t0 = Date.now();
  const dryRun = Boolean(options.dry_run);
  const mode = dryRun ? '[dry_run] ' : '';
  log(`--- sweep start ${mode}---`);

  const result = {
    ok: true,
    ts: ts(),
    dry_run: dryRun,
    health: {},
    provenance: {},
    sweep: {},
    handoffs: {},
  };

  try {
    // Resolve project list
    const baseDir = deps.findRepoRoot();
    const config = deps.gadConfig.load(baseDir);
    let allProjects = (config.roots || []).map((r) => ({
      projectId: r.id,
      rootPath: path.resolve(baseDir, r.path || '.'),
      planningDir: r.planningDir || '.planning',
    }));

    if (projectFilter && projectFilter.length > 0) {
      const filter = new Set(projectFilter);
      allProjects = allProjects.filter((p) => filter.has(p.projectId));
    }

    // Step 1: health
    if (!options.skip_health) {
      try {
        result.health = stepHealth(log, { dry_run: dryRun });
      } catch (e) {
        log(`health error: ${e.message}`);
        result.health = { error: e.message };
        result.ok = false;
      }
    } else {
      log('health: skipped');
      result.health = { skipped: true };
    }

    // Step 2: provenance
    if (!options.skip_provenance) {
      try {
        result.provenance = stepProvenance(allProjects, log, { dry_run: dryRun });
        if (!result.provenance.ok) result.ok = false;
      } catch (e) {
        log(`provenance error: ${e.message}`);
        result.provenance = { error: e.message };
        result.ok = false;
      }
    } else {
      log('provenance: skipped');
      result.provenance = { skipped: true };
    }

    // Step 3: sweep phases
    if (!options.skip_sweep) {
      try {
        result.sweep = stepSweepPhases(allProjects, log, { dry_run: dryRun });
      } catch (e) {
        log(`sweep error: ${e.message}`);
        result.sweep = { error: e.message };
        result.ok = false;
      }
    } else {
      log('sweep: skipped');
      result.sweep = { skipped: true };
    }

    // Step 4: ensure handoffs
    if (!options.skip_handoffs) {
      try {
        result.handoffs = stepEnsureHandoffs(allProjects, log, { dry_run: dryRun });
      } catch (e) {
        log(`handoff error: ${e.message}`);
        result.handoffs = { error: e.message };
        result.ok = false;
      }
    } else {
      log('handoffs: skipped');
      result.handoffs = { skipped: true };
    }
  } finally {
    _runtime.sweeping = false;
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log(`--- sweep end (${elapsed}s) ok=${result.ok} ---`);
    result.elapsed_s = parseFloat(elapsed);
  }

  return result;
}

module.exports = { runSweep };
