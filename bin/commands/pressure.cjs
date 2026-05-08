'use strict';
/**
 * bin/commands/pressure.cjs — gad pressure snapshot
 *
 * Combined pressure snapshot: entropy v1+v2, handoff pressure, worker load,
 * and token budget. Outputs JSON (--json) or human-readable table.
 *
 * Usage:
 *   gad pressure snapshot [--projectid X] [--since 7d] [--json]
 *
 * Auto-loaded by bin/commands/_loader.cjs — no edits to bin/gad.cjs required.
 */

const path = require('path');
const { defineCommand } = require('citty');
const { snapshotPressure } = require('../../lib/pressure/snapshot.cjs');

// ---------------------------------------------------------------------------
// human-readable renderer
// ---------------------------------------------------------------------------

function renderPressureSnapshot(snap) {
  const lines = [];
  const ts = snap.ts ? snap.ts.replace('T', ' ').slice(0, 19) + 'Z' : 'unknown';

  lines.push(`Pressure snapshot — ${ts}`);
  lines.push('');

  // Entropy
  const v1 = snap.entropy_v1 || {};
  const v2 = snap.entropy_v2 || {};
  lines.push('Entropy');
  lines.push(`  v1 score:           ${formatScore(v1.score)}`);
  lines.push(`  v2 score:           ${formatScore(v2.score)}  (diversity=${formatScore(v2.decomposition_diversity)})`);
  lines.push(`  top phase:          ${v1.top_phase || 'n/a'}  (score=${formatScore(v1.top_phase_score)})`);

  if (v1.breakdown) {
    const bd = v1.breakdown;
    lines.push(`  rate-limits:        ${bd.rate_limits || 0}`);
    lines.push(`  open handoffs:      ${bd.open_handoffs || 0}`);
    lines.push(`  worker failures:    ${bd.worker_failures || 0}`);
    lines.push(`  errors (recent):    ${bd.errors_recent || 0}  open=${bd.errors_open || 0}`);
    lines.push(`  resolved signals:   ${bd.resolved_signals || 0}`);
  }
  lines.push('');

  // Handoff pressure
  const hp = snap.handoff_pressure || {};
  lines.push('Handoff pressure');
  lines.push(`  open queue:         ${hp.open || 0}`);
  lines.push(`  avg claim age:      ${hp.avg_claim_age_hours || 0}h`);
  lines.push('');

  // Worker load
  const wl = snap.worker_load || {};
  lines.push('Worker load');
  lines.push(`  total in-progress:  ${wl.total_in_progress || 0}`);
  if (wl.workers && wl.workers.length > 0) {
    for (const w of wl.workers) {
      lines.push(`    ${w.id}: ${w.in_progress} task(s) in-progress`);
    }
  } else {
    lines.push('    (no attributed in-progress tasks)');
  }
  lines.push('');

  // Token budget
  const tb = snap.token_budget;
  lines.push('Token budget');
  if (!tb) {
    lines.push('  (unavailable — runtime-budget data absent)');
  } else {
    lines.push(`  total tokens:       ${tb.total_tokens || 0}`);
    if (tb.since) lines.push(`  since:              ${tb.since}`);
    if (tb.by_runtime) {
      for (const [rt, r] of Object.entries(tb.by_runtime)) {
        lines.push(`    ${rt}: ${r.count} handoff(s), ${r.totalTokens} tokens (avg ${r.avgTokens})`);
      }
    }
  }

  return lines.join('\n');
}

function formatScore(n) {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  return n.toFixed(3);
}

// ---------------------------------------------------------------------------
// command definition
// ---------------------------------------------------------------------------

function createPressureCommand(deps = {}) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError, shouldUseJson } = deps;

  function resolveProjectRoot(projectid) {
    try {
      const baseDir = typeof findRepoRoot === 'function' ? findRepoRoot() : process.cwd();
      if (gadConfig && typeof gadConfig.load === 'function' && typeof resolveRoots === 'function') {
        const config = gadConfig.load(baseDir);
        const roots = resolveRoots({ projectid: projectid || '' }, baseDir, config.roots);
        if (roots && roots.length > 0) {
          return {
            projectRoot: path.resolve(baseDir, roots[0].path || '.'),
            projectid: roots[0].id || projectid || 'unknown',
          };
        }
      }
      return { projectRoot: baseDir, projectid: projectid || 'unknown' };
    } catch {
      return { projectRoot: process.cwd(), projectid: projectid || 'unknown' };
    }
  }

  const pressureSnapshotCmd = defineCommand({
    meta: {
      name: 'snapshot',
      description: 'Combined pressure snapshot: entropy v1+v2, handoff queue, worker load, token budget',
    },
    args: {
      projectid: {
        type: 'string',
        description: 'Target project id',
        default: '',
      },
      since: {
        type: 'string',
        description: 'Time window for diversity metrics (e.g. 7d, 2026-05-01)',
        default: '',
      },
      json: {
        type: 'boolean',
        description: 'Output raw JSON',
        default: false,
      },
    },
    run({ args }) {
      const useJson = args.json
        || (typeof shouldUseJson === 'function' ? shouldUseJson(args) : false);

      const { projectRoot, projectid } = resolveProjectRoot(args.projectid || '');

      let snap;
      try {
        snap = snapshotPressure({
          projectRoot,
          since: args.since || undefined,
          projectid,
        });
      } catch (err) {
        const errFn = typeof outputError === 'function' ? outputError : console.error.bind(console);
        errFn(`pressure snapshot failed: ${err.message}`);
        process.exit(1);
        return;
      }

      if (useJson) {
        process.stdout.write(JSON.stringify(snap, null, 2) + '\n');
      } else {
        console.log(renderPressureSnapshot(snap));
      }
    },
  });

  const pressureCmd = defineCommand({
    meta: {
      name: 'pressure',
      description: 'Pressure metrics — combined entropy, handoff queue, worker load, token budget',
    },
    subCommands: {
      snapshot: pressureSnapshotCmd,
    },
  });

  return pressureCmd;
}

// ---------------------------------------------------------------------------
// loader contract
// ---------------------------------------------------------------------------

module.exports = { createPressureCommand };

module.exports.provides = (ctx) => ({
  cmd: createPressureCommand(ctx.common),
});

module.exports.register = (ctx) => ({
  pressure: ctx.services.pressure.cmd,
});
