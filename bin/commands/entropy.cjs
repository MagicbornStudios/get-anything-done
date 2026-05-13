'use strict';
/**
 * gad entropy — Skill Entropy CLI.
 *
 * Subcommands:
 *   gad entropy snapshot [--projectid X] [--since 7d|YYYY-MM-DD] [--json]
 *   gad entropy benchmark [--projectid X] [--since X] [--json]
 *   gad entropy compare --generations <g1:s1:u1,g2:s2:u2,...> [--json]
 *   gad entropy explain
 *
 * Auto-loaded by bin/commands/_loader.cjs via the register() export.
 * No edits to bin/gad.cjs required.
 *
 * Phase 88, task 88-01.
 * Reference: vendor/get-anything-done/references/skill-entropy.md
 */

const path = require('path');
const { defineCommand } = require('citty');

const { runBenchmark, crossGenerationCompare, ALPHA, BETA } = require('../../lib/entropy/benchmark.cjs');
const { computeEntropyV2 } = require('../../lib/entropy/v2.cjs');
const { scoreRubric, RUBRIC_DIMENSIONS } = require('../../lib/entropy/rubric.cjs');

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const ANSI = process.stdout.isTTY
  ? { bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', reset: '\x1b[0m' }
  : { bold: '', dim: '', green: '', yellow: '', red: '', reset: '' };

function entropyColor(h) {
  if (h <= 0.33) return ANSI.green;
  if (h <= 0.66) return ANSI.yellow;
  return ANSI.red;
}

function fmtH(h) {
  return typeof h === 'number' ? h.toFixed(3) : 'N/A';
}

function entropyBar(h, width = 20) {
  if (typeof h !== 'number') return '[' + '?'.repeat(width) + ']';
  const filled = Math.round(h * width);
  return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']';
}

function pad(s, w) {
  return String(s == null ? '' : s).slice(0, w).padEnd(w);
}

// ── Subcommand: snapshot ──────────────────────────────────────────────────────

const entropySnapshotCmd = defineCommand({
  meta: { name: 'snapshot', description: 'Current H/D/H_total snapshot with dimension breakdown' },
  args: {
    projectid: { type: 'string', description: 'Project ID (default: auto-detect)', default: '' },
    since: { type: 'string', description: 'Since date: 7d|14d|YYYY-MM-DD (default: 7d)', default: '7d' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const projectid = args.projectid || undefined;
    const since = args.since || '7d';

    // Find project root — walk up from cwd looking for .planning/
    const fs = require('fs');
    function findRoot(start) {
      let dir = start;
      for (let i = 0; i < 10; i++) {
        if (fs.existsSync(path.join(dir, '.planning'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return start;
    }
    const projectRoot = findRoot(process.cwd());

    let bench;
    try {
      bench = runBenchmark({ projectRoot, since, projectid });
    } catch (err) {
      if (args.json) {
        console.log(JSON.stringify({ error: err.message }, null, 2));
      } else {
        console.error('entropy snapshot error:', err.message);
      }
      process.exit(1);
      return;
    }

    // Also get rubric scores for dimension breakdown
    let rubric;
    try {
      rubric = scoreRubric({ projectRoot, since });
    } catch {
      rubric = [];
    }

    if (args.json) {
      console.log(JSON.stringify({
        projectid: projectid || 'auto',
        since,
        H: bench.H,
        D: bench.D,
        H_total: bench.H_total,
        alpha: ALPHA,
        beta: BETA,
        inputs: bench.inputs,
        type_counts: bench.type_counts,
        v1_score: bench.v1_score,
        rubric,
        generated_at: bench.generated_at,
      }, null, 2));
      return;
    }

    // Pretty output
    console.log('');
    console.log(ANSI.bold + 'GAD Skill Entropy Snapshot' + ANSI.reset);
    console.log(ANSI.dim + `Since: ${since}  |  Project: ${projectid || 'auto'}  |  ${bench.generated_at}` + ANSI.reset);
    console.log('');

    const hc = entropyColor(bench.H_total);
    console.log(ANSI.bold + 'Entropy Summary' + ANSI.reset);
    console.log(ANSI.dim + '─'.repeat(60) + ANSI.reset);
    console.log(`  ${pad('H (pressure-type)', 28)} ${hc}${fmtH(bench.H)}${ANSI.reset}  ${ANSI.dim}(Shannon entropy over event-type distribution)${ANSI.reset}`);
    console.log(`  ${pad('D (decomp diversity)', 28)} ${hc}${fmtH(bench.D)}${ANSI.reset}  ${ANSI.dim}(unique/total decomposition sequences)${ANSI.reset}`);
    console.log(`  ${pad('H_total (α·H + β·D)', 28)} ${hc}${fmtH(bench.H_total)}${ANSI.reset}  ${hc}${entropyBar(bench.H_total)}${ANSI.reset}`);
    console.log(`  ${ANSI.dim}α=${ALPHA}  β=${BETA}${ANSI.reset}`);
    console.log('');

    // Input signals table
    console.log(ANSI.bold + 'Input Signals' + ANSI.reset);
    console.log(ANSI.dim + '─'.repeat(60) + ANSI.reset);
    const sigHeader = ['SIGNAL', 'VALUE', 'UNIT'];
    const sigW = [32, 12, 20];
    console.log(ANSI.bold + sigHeader.map((h, i) => pad(h, sigW[i])).join('  ') + ANSI.reset);
    console.log(ANSI.dim + sigW.map((w) => '─'.repeat(w)).join('  ') + ANSI.reset);

    const rows = [
      ['handoff-claim-time', bench.inputs.meanClaimTimeSec, 'seconds (mean)'],
      ['retry-count', bench.inputs.totalRetries, 'unclaims'],
      ['tool-call-density', bench.inputs.toolCallDensity, 'calls/session'],
      ['worker-mailbox-depth', bench.inputs.workerMailboxDepth, 'open handoffs'],
      ['runtime-rate-limit', bench.inputs.rateLimitEvents, 'events'],
      ['edit-conflict', bench.inputs.editConflictEvents, 'events'],
      ['discipline-rule-fail', bench.inputs.disciplineFailEvents, 'events'],
    ];
    for (const [sig, val, unit] of rows) {
      console.log(pad(sig, sigW[0]) + '  ' + pad(val, sigW[1]) + '  ' + pad(unit, sigW[2]));
    }
    console.log('');

    // Rubric dimensions
    if (rubric.length > 0) {
      console.log(ANSI.bold + 'Rubric Dimensions' + ANSI.reset);
      console.log(ANSI.dim + '─'.repeat(60) + ANSI.reset);
      const rh = ['DIMENSION', 'SCORE', 'WEIGHT'];
      const rw = [34, 8, 8];
      console.log(ANSI.bold + rh.map((h, i) => pad(h, rw[i])).join('  ') + ANSI.reset);
      console.log(ANSI.dim + rw.map((w) => '─'.repeat(w)).join('  ') + ANSI.reset);
      for (const r of rubric) {
        const sc = typeof r.score === 'number' ? r.score.toFixed(3) : 'N/A';
        console.log(pad(r.dimension, rw[0]) + '  ' + pad(sc, rw[1]) + '  ' + pad(r.weight.toFixed(2), rw[2]));
      }
      console.log('');
    }
  },
});

// ── Subcommand: benchmark ─────────────────────────────────────────────────────

const entropyBenchmarkCmd = defineCommand({
  meta: { name: 'benchmark', description: 'Run full rubric + entropy benchmark' },
  args: {
    projectid: { type: 'string', description: 'Project ID', default: '' },
    since: { type: 'string', description: 'Since date: 7d|14d|YYYY-MM-DD (default: 7d)', default: '7d' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const projectid = args.projectid || undefined;
    const since = args.since || '7d';

    const fs = require('fs');
    function findRoot(start) {
      let dir = start;
      for (let i = 0; i < 10; i++) {
        if (fs.existsSync(path.join(dir, '.planning'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return start;
    }
    const projectRoot = findRoot(process.cwd());

    let bench, rubric;
    try {
      bench = runBenchmark({ projectRoot, since, projectid });
      rubric = scoreRubric({ projectRoot, since });
    } catch (err) {
      if (args.json) {
        console.log(JSON.stringify({ error: err.message }, null, 2));
      } else {
        console.error('entropy benchmark error:', err.message);
      }
      process.exit(1);
      return;
    }

    // Composite rubric score (weighted sum of dimension scores)
    const compositeScore = rubric.reduce((acc, r) => acc + r.score * r.weight, 0);

    if (args.json) {
      console.log(JSON.stringify({
        projectid: projectid || 'auto',
        since,
        entropy: {
          H: bench.H,
          D: bench.D,
          H_total: bench.H_total,
          alpha: ALPHA,
          beta: BETA,
        },
        rubric,
        composite_score: Math.round(compositeScore * 1000) / 1000,
        inputs: bench.inputs,
        generated_at: bench.generated_at,
      }, null, 2));
      return;
    }

    // Pretty output
    console.log('');
    console.log(ANSI.bold + 'GAD Skill Entropy Benchmark' + ANSI.reset);
    console.log(ANSI.dim + `Since: ${since}  |  Project: ${projectid || 'auto'}  |  ${bench.generated_at}` + ANSI.reset);
    console.log('');

    // Entropy row
    const hc = entropyColor(bench.H_total);
    console.log(ANSI.bold + `H_total: ${hc}${fmtH(bench.H_total)}${ANSI.reset}  ${hc}${entropyBar(bench.H_total)}${ANSI.reset}  H=${fmtH(bench.H)} D=${fmtH(bench.D)}`);
    console.log('');

    // Rubric table
    console.log(ANSI.bold + 'Rubric Breakdown' + ANSI.reset);
    console.log(ANSI.dim + '─'.repeat(80) + ANSI.reset);
    const rh = ['DIMENSION', 'SCORE', 'WEIGHT', 'EVIDENCE'];
    const rw = [34, 7, 7, 28];
    console.log(ANSI.bold + rh.map((h, i) => pad(h, rw[i])).join('  ') + ANSI.reset);
    console.log(ANSI.dim + rw.map((w) => '─'.repeat(w)).join('  ') + ANSI.reset);

    for (const r of rubric) {
      const sc = typeof r.score === 'number' ? r.score.toFixed(3) : 'N/A';
      const ev = String(r.evidence || '').slice(0, rw[3]);
      console.log(
        pad(r.dimension, rw[0]) + '  ' +
        pad(sc, rw[1]) + '  ' +
        pad(r.weight.toFixed(2), rw[2]) + '  ' +
        ev
      );
    }
    console.log(ANSI.dim + '─'.repeat(80) + ANSI.reset);
    const csColor = compositeScore >= 0.7 ? ANSI.green : compositeScore >= 0.4 ? ANSI.yellow : ANSI.red;
    console.log(`${ANSI.bold}Composite score: ${csColor}${compositeScore.toFixed(3)}${ANSI.reset}`);
    console.log('');
  },
});

// ── Subcommand: compare ───────────────────────────────────────────────────────

const entropyCompareCmd = defineCommand({
  meta: { name: 'compare', description: 'Cross-generation entropy comparison table' },
  args: {
    generations: {
      type: 'string',
      description: 'Comma-separated list of id:since:until (e.g. g1:2026-05-01:2026-05-07,g2:2026-04-01:2026-04-30)',
      required: true,
    },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const genStr = args.generations || '';
    const generations = genStr.split(',').map((g) => {
      const parts = g.trim().split(':');
      return {
        id: parts[0] || 'unknown',
        since: parts[1] || '7d',
        until: parts[2] || null,
      };
    }).filter((g) => g.id && g.id !== 'unknown');

    if (generations.length === 0) {
      console.error('No valid generations parsed from --generations argument.');
      console.error('Format: id:since:until,...  e.g. g1:2026-05-01:2026-05-07,g2:2026-04-01:2026-04-30');
      process.exit(1);
      return;
    }

    const fs = require('fs');
    function findRoot(start) {
      let dir = start;
      for (let i = 0; i < 10; i++) {
        if (fs.existsSync(path.join(dir, '.planning'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return start;
    }
    const projectRoot = findRoot(process.cwd());

    let rows;
    try {
      rows = crossGenerationCompare({ projectRoot, generations });
    } catch (err) {
      if (args.json) {
        console.log(JSON.stringify({ error: err.message }, null, 2));
      } else {
        console.error('entropy compare error:', err.message);
      }
      process.exit(1);
      return;
    }

    if (args.json) {
      console.log(JSON.stringify({ generations: rows }, null, 2));
      return;
    }

    console.log('');
    console.log(ANSI.bold + 'GAD Skill Entropy — Cross-Generation Comparison' + ANSI.reset);
    console.log(ANSI.dim + 'Sorted ascending by H_total (lowest = cleanest execution)' + ANSI.reset);
    console.log('');

    const cols = ['RANK', 'ID', 'SINCE', 'UNTIL', 'H', 'D', 'H_TOTAL', 'BAR'];
    const cw = [5, 20, 14, 14, 7, 7, 8, 22];
    console.log(ANSI.bold + cols.map((c, i) => pad(c, cw[i])).join('  ') + ANSI.reset);
    console.log(ANSI.dim + cw.map((w) => '─'.repeat(w)).join('  ') + ANSI.reset);

    rows.forEach((r, idx) => {
      const hc = entropyColor(r.H_total);
      console.log(
        pad(idx + 1, cw[0]) + '  ' +
        pad(r.id, cw[1]) + '  ' +
        pad(r.since, cw[2]) + '  ' +
        pad(r.until || '—', cw[3]) + '  ' +
        pad(fmtH(r.H), cw[4]) + '  ' +
        pad(fmtH(r.D), cw[5]) + '  ' +
        hc + pad(fmtH(r.H_total), cw[6]) + ANSI.reset + '  ' +
        hc + entropyBar(r.H_total) + ANSI.reset
      );
    });
    console.log('');
  },
});

// ── Subcommand: explain ───────────────────────────────────────────────────────

const EXPLAIN_TEXT = `
GAD SKILL ENTROPY — REFERENCE SUMMARY
======================================

NAMING
  "Skill Entropy" / "Garrard pressure entropy" (GLOBAL-D-291).
  Parallel to Shannon information entropy:
    Shannon:       H(X) = -sum p_i log2(p_i) — uncertainty over message symbols
    Skill Entropy: H(S,t) = uncertainty over failure/decomposition patterns emitted
                            by a task class over time window t

WHY IT EXISTS
  Pressure measures how much resistance a task class generates.
  Skill Entropy measures how SCATTERED that resistance is.
    High pressure + low entropy  -> coherent failure shape -> a skill can emerge
    High pressure + high entropy -> scattered failures -> no reusable shape yet
    Low pressure + low entropy   -> domesticated task class

FORMULA (BENCHMARK VARIANT — phase 88)
  H(S,t) = -sum_i p_i * log2(p_i)
    where p_i = normalized frequency of pressure-event type i over window t
    Event types: handoff-claim-time, retry-count, tool-call-density,
                 worker-mailbox-depth, runtime-rate-limit, edit-conflict,
                 discipline-rule-fail

  D(S,t) = unique_decompositions / total_decompositions   (from v2.cjs)

  H_total = alpha*H + beta*D    (alpha=0.7, beta=0.3)

CANONICAL ESTIMATOR (phase 88+89, from references/skill-entropy.md)
  H_skill(c) = alpha*h_shape(c) + beta*h_retry(c) + gamma*h_pressure(c)
  Default: alpha=beta=gamma=1/3
  Each component normalized to [0,1] via log2(|buckets|).

INTERPRETATION
  H_total ~= 0.0  -> entropy collapse; strong skill candidate
  H_total ~= 0.5  -> partial convergence; skill forming
  H_total ~= 1.0  -> maximum scatter; no stable shape yet

BENCHMARK SUITE INPUTS
  Signal                Unit            Source
  handoff-claim-time    seconds (mean)  .planning/handoffs/
  retry-count           unclaims        handoff unclaim_history
  tool-call-density     calls/session   .planning/sessions/*.telemetry.jsonl
  worker-mailbox-depth  open handoffs   .planning/handoffs/open/
  runtime-rate-limit    events          .planning/.gad-log/ + worker logs
  edit-conflict         events          .planning/.gad-log/
  discipline-rule-fail  events          .planning/team/workers/*/log.jsonl

EVAL RUBRIC (per generation)
  Dimension                    Weight  Description
  total-entropy                0.30    1 - H_total (lower entropy = better)
  peak-entropy                 0.15    1 - peak H_total within window
  entropy-decay-rate           0.20    Does entropy trend downward?
  discipline-weighted-entropy  0.20    Discipline failures amplified by H_total
  handoff-flow-efficiency      0.10    1 - retry_ratio across handoffs
  decomposition-diversity      0.05    D (richer skill expression)

CROSS-GENERATION HYPOTHESIS
  Species evolution should reduce H_total across generations.
  gad entropy compare --generations g1:s1:u1,g2:s2:u2 tests this.

CLI COMMANDS
  gad entropy snapshot [--projectid X] [--since 7d|YYYY-MM-DD] [--json]
  gad entropy benchmark [--projectid X] [--since X] [--json]
  gad entropy compare --generations id:since:until,... [--json]
  gad entropy explain

REFERENCE
  vendor/get-anything-done/references/skill-entropy.md
  lib/entropy/compute.cjs   (v1 pressure signals)
  lib/entropy/v2.cjs        (v2 decomposition diversity)
  lib/entropy/benchmark.cjs (this formula)
  lib/entropy/rubric.cjs    (eval rubric)
  Decision: GLOBAL-D-291
`;

const entropyExplainCmd = defineCommand({
  meta: { name: 'explain', description: 'Print a short version of the skill-entropy reference doc' },
  args: {},
  run() {
    console.log(EXPLAIN_TEXT);
  },
});

// ── Subcommand: compute ───────────────────────────────────────────────────────

const entropyComputeCmd = defineCommand({
  meta: { name: 'compute', description: 'Compute pressure scalar (0.0-1.0). Use --format compact for statusline.' },
  args: {
    projectid: { type: 'string', description: 'Project ID (default: auto-detect)', default: '' },
    format: { type: 'string', description: 'Output format: json|compact (default: json)', default: 'json' },
  },
  run({ args }) {
    const { computePressure } = require('../../lib/entropy/compute.cjs');
    const { buildCompactStatusline } = require('../../lib/agents/evolution-context.cjs');
    const fs = require('fs');

    function findRoot(start) {
      let dir = start;
      for (let i = 0; i < 10; i++) {
        if (fs.existsSync(path.join(dir, '.planning'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return start;
    }
    const projectRoot = findRoot(process.cwd());
    const projectid = args.projectid || undefined;

    let pressure;
    try {
      pressure = computePressure(projectid, { baseDir: projectRoot });
    } catch (err) {
      pressure = { score: 0, top_phase: 'error', top_phase_score: 0, error: err.message };
    }

    if (args.format === 'compact') {
      console.log(buildCompactStatusline(pressure.score));
      return;
    }

    console.log(JSON.stringify({
      projectid: projectid || 'auto',
      score: pressure.score,
      top_phase: pressure.top_phase,
      top_phase_score: pressure.top_phase_score,
      breakdown: pressure.breakdown || null,
      updated_at: pressure.updated_at || new Date().toISOString(),
    }, null, 2));
  },
});

// ── Top-level command ─────────────────────────────────────────────────────────

function register(_ctx) {
  const entropyCmd = defineCommand({
    meta: {
      name: 'entropy',
      description: 'Skill Entropy — measure and benchmark AI agent execution quality (phase 88)',
    },
    subCommands: {
      snapshot: entropySnapshotCmd,
      benchmark: entropyBenchmarkCmd,
      compare: entropyCompareCmd,
      compute: entropyComputeCmd,
      explain: entropyExplainCmd,
    },
  });

  return { entropy: entropyCmd };
}

module.exports = { register };
