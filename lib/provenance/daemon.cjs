'use strict';
/**
 * lib/provenance/daemon.cjs — long-running provenance loop.
 *
 * One process that does on a cadence:
 *   1. gad provenance build     (across all planning roots)
 *   2. gad provenance export    (writes to slm_learning/data/)
 *   3. (optional) the file watcher (gad provenance watch) is started in
 *      the same process so fs_change events land while the daemon runs
 *
 * Operator standing rule 2026-05-07: "we want a lot of processes and
 * automation for staying in sync." The daemon IS the orchestrator that
 * makes provenance reactive — without it, gad provenance build is a
 * manual cron job that nobody runs reliably.
 */

const path = require('node:path');
const fs = require('node:fs');
const { startWatching } = require('./watch.cjs');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;  // 5 min — tight enough for real-time, loose enough not to thrash git

/**
 * Run one full pass across all planning roots: build + export.
 * Returns a summary; never throws (errors are logged + swallowed so the
 * daemon stays alive across transient failures).
 */
async function runOnce({ buildFn, exportFn, projects, baseDir, slmLearningDir, log }) {
  const summary = { tick_at: new Date().toISOString(), build: {}, export: {} };

  for (const project of projects) {
    const planningDir = path.join(project.rootPath, project.planningDir);
    const traceJsonlPath = path.join(planningDir, '.trace-events.jsonl');
    if (!fs.existsSync(traceJsonlPath) && !fs.existsSync(path.join(planningDir, '.trace-archive'))) continue;
    try {
      const result = buildFn({
        planningDir,
        traceJsonlPath,
        projects,
      });
      summary.build[project.projectId] = {
        events_total: result.events_total,
        events_kept: result.events_kept,
      };
    } catch (e) {
      log(`[daemon] build failed for ${project.projectId}: ${e.message}`);
      summary.build[project.projectId] = { error: e.message };
    }
  }

  // Export across all projects to slm_learning sink
  try {
    if (!fs.existsSync(slmLearningDir)) fs.mkdirSync(slmLearningDir, { recursive: true });
    let totalTuples = 0;
    for (const project of projects) {
      const planningDir = path.join(project.rootPath, project.planningDir);
      try {
        const result = exportFn({
          planningDir,
          outDir: slmLearningDir,
          projectid: project.projectId,
          labels: null,  // export everything; trainer filters downstream
        });
        totalTuples += (result.tuples_emitted || 0);
        summary.export[project.projectId] = result.tuples_emitted || 0;
      } catch (e) {
        log(`[daemon] export failed for ${project.projectId}: ${e.message}`);
        summary.export[project.projectId] = { error: e.message };
      }
    }
    summary.tuples_total = totalTuples;
  } catch (e) {
    log(`[daemon] cross-project export failed: ${e.message}`);
  }

  return summary;
}

/**
 * Start the daemon. Returns { stop: () => void, manualTick: () => Promise }.
 */
async function startDaemon({ intervalMs, projects, baseDir, slmLearningDir, watch, watchProject, log, buildFn, exportFn, joinFn, surviveFn, freqFn, labelFn, workerFn, ensureProvenanceDir, gadConfig }) {
  log(`[daemon] starting. interval=${intervalMs / 1000}s. projects=${projects.length}. sink=${slmLearningDir}`);
  if (watch) log(`[daemon] watcher will run on ${watchProject || 'all roots'}`);

  // Internal: orchestrated build pass that runs all annotators
  async function fullBuildPass() {
    const summary = { tick_at: new Date().toISOString(), projects: {} };
    for (const project of projects) {
      const planningDir = path.join(project.rootPath, project.planningDir);
      const traceJsonlPath = path.join(planningDir, '.trace-events.jsonl');
      const archiveDir = path.join(planningDir, '.trace-archive');
      if (!fs.existsSync(traceJsonlPath) && !fs.existsSync(archiveDir)) continue;
      try {
        const join = joinFn({ planningDir, traceJsonlPath, projects });
        const wj = workerFn ? workerFn({ planningDir }) : null;
        const sv = surviveFn ? surviveFn({ planningDir, baseDir }) : null;
        const fq = freqFn ? freqFn({ planningDir }) : null;
        const lb = labelFn ? labelFn({ planningDir, config: gadConfig }) : null;
        summary.projects[project.projectId] = {
          claude_kept: join.events_kept,
          worker_kept: wj ? wj.events_kept : 0,
          labeled: lb ? lb.by_label : null,
        };
      } catch (e) {
        log(`[daemon] build error ${project.projectId}: ${e.message}`);
        summary.projects[project.projectId] = { error: e.message };
      }
    }
    return summary;
  }

  async function exportPass() {
    if (!fs.existsSync(slmLearningDir)) fs.mkdirSync(slmLearningDir, { recursive: true });
    const summary = { exported: {} };
    let total = 0;
    for (const project of projects) {
      const planningDir = path.join(project.rootPath, project.planningDir);
      try {
        const r = exportFn({ planningDir, outDir: slmLearningDir, projectid: project.projectId, labels: null });
        summary.exported[project.projectId] = r.tuples_emitted || 0;
        total += (r.tuples_emitted || 0);
      } catch (e) {
        log(`[daemon] export error ${project.projectId}: ${e.message}`);
      }
    }
    summary.total_tuples = total;
    return summary;
  }

  async function tick() {
    const t0 = Date.now();
    const buildSummary = await fullBuildPass();
    const exportSummary = await exportPass();
    log(`[daemon] tick ${new Date().toISOString()} — built ${Object.keys(buildSummary.projects).length} projects, exported ${exportSummary.total_tuples} tuples in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  // Optional watcher
  let watcherHandles = [];
  if (watch) {
    const watchTargets = watchProject
      ? projects.filter((p) => p.projectId === watchProject)
      : projects;
    for (const project of watchTargets) {
      const planningDir = path.join(project.rootPath, project.planningDir);
      if (!fs.existsSync(planningDir)) continue;
      try {
        const handle = startWatching({
          planningDir,
          rootPath: project.rootPath,
          debounceMs: 500,
          onEmit: null,
        });
        watcherHandles.push({ project, handle });
        log(`[daemon] watching ${project.projectId} (${handle.watcherCount} fs.watch handles)`);
      } catch (e) {
        log(`[daemon] watcher start failed for ${project.projectId}: ${e.message}`);
      }
    }
  }

  // First tick immediately, then schedule
  await tick();
  const interval = setInterval(() => {
    tick().catch((e) => log(`[daemon] tick failed: ${e.message}`));
  }, intervalMs);

  return {
    stop: () => {
      clearInterval(interval);
      for (const { handle } of watcherHandles) {
        try { handle.stop(); } catch {}
      }
      log('[daemon] stopped.');
    },
    manualTick: tick,
  };
}

module.exports = { startDaemon, runOnce, DEFAULT_INTERVAL_MS };
