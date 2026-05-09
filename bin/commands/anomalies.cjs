'use strict';
/**
 * gad anomalies — surface rule-based anomaly detection results.
 *
 * Subcommands:
 *   list       [--projectid <id>] [--lookback-h N] [--severity warn|critical] [--json]
 *   describe   <rule_id>
 *   baseline   [--days 14] [--json]
 *
 * Pattern: factory command per bin/commands/ convention.
 */

const fs   = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { detectAnomalies, computeBaseline, describeAnomaly, ANOMALY_RULES } =
  require('../../lib/anomalies/detector.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pad a string to width (left-align). */
function pad(s, w) {
  return String(s == null ? '' : s).padEnd(w);
}

function renderAnomalyTable(anomalies) {
  if (!anomalies.length) {
    console.log('ANOMALIES: none');
    return;
  }
  const cols = ['rule_id', 'severity', 'category', 'description'];
  const widths = { rule_id: 30, severity: 8, category: 18, description: 60 };
  const sep = Object.values(widths).map((w) => '-'.repeat(w));
  const header = cols.map((c, i) => pad(c, Object.values(widths)[i])).join('  ');
  const divider = sep.join('  ');
  console.log(header);
  console.log(divider);
  for (const a of anomalies) {
    console.log([
      pad(a.rule_id, widths.rule_id),
      pad(a.severity, widths.severity),
      pad(a.category, widths.category),
      pad(describeAnomaly(a).slice(0, widths.description), widths.description),
    ].join('  '));
  }
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

function createAnomaliesCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots } = deps;

  function resolveBaseDir(args) {
    try {
      const repoRoot = findRepoRoot();
      const config = gadConfig.load(repoRoot);
      const projectid = (args && args.projectid) || '';
      const roots = resolveRoots({ projectid }, repoRoot, config.roots || []);
      const root = roots[0];
      if (!root) return repoRoot;
      const resolved = path.join(repoRoot, root.path);
      if (fs.existsSync(path.join(resolved, '.planning'))) return resolved;
      if (fs.existsSync(path.join(repoRoot, '.planning'))) return repoRoot;
      return resolved;
    } catch {
      return process.cwd();
    }
  }

  // ── list ──────────────────────────────────────────────────────────────────
  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List all currently-fired anomalies.' },
    args: {
      projectid:    { type: 'string',  description: 'Project id', default: '' },
      'lookback-h': { type: 'string',  description: 'Lookback window in hours (default: 24)', default: '24' },
      severity:     { type: 'string',  description: 'Filter to severity: warn | critical', default: '' },
      json:         { type: 'boolean', description: 'Emit JSON result', default: false },
    },
    async run({ args }) {
      const baseDir = resolveBaseDir(args);
      const lookback_h = parseInt(args['lookback-h'] || '24', 10) || 24;
      const severity = args.severity || null;

      const anomalies = await detectAnomalies({ baseDir, projectid: args.projectid || '', lookback_h, severity });

      if (args.json) {
        process.stdout.write(JSON.stringify({ ok: true, count: anomalies.length, anomalies }, null, 2) + '\n');
        return;
      }

      console.log('\n=== gad anomalies list ===\n');
      console.log(`Lookback: ${lookback_h}h  |  Rules: ${ANOMALY_RULES.length}  |  Fired: ${anomalies.length}\n`);
      renderAnomalyTable(anomalies);
      console.log('');

      if (anomalies.length > 0) {
        console.log('--- details ---');
        for (const a of anomalies) {
          console.log(`\n[${a.rule_id}]`);
          console.log(`  ${describeAnomaly(a)}`);
          console.log(`  evidence: ${JSON.stringify(a.evidence)}`);
        }
        console.log('');
      }
    },
  });

  // ── describe ──────────────────────────────────────────────────────────────
  const describeCmd = defineCommand({
    meta: { name: 'describe', description: 'Show full details for a specific anomaly rule.' },
    args: {
      rule_id: { type: 'positional', description: 'Rule ID', required: true },
    },
    async run({ args }) {
      const rule = ANOMALY_RULES.find((r) => r.id === args.rule_id);
      if (!rule) {
        console.error(`Unknown rule_id: ${args.rule_id}`);
        console.error('Available rules:');
        for (const r of ANOMALY_RULES) {
          console.error(`  ${r.id}  (${r.severity}, ${r.category})`);
        }
        process.exit(1);
      }
      console.log('\n=== anomaly rule ===\n');
      console.log(`id:          ${rule.id}`);
      console.log(`category:    ${rule.category}`);
      console.log(`severity:    ${rule.severity}`);
      console.log(`description: ${rule.description}`);
      console.log('');
    },
  });

  // ── baseline ──────────────────────────────────────────────────────────────
  const baselineCmd = defineCommand({
    meta: { name: 'baseline', description: 'Show what the system considers "normal" token spend (baseline statistics).' },
    args: {
      projectid: { type: 'string',  description: 'Project id', default: '' },
      days:      { type: 'string',  description: 'Lookback window in days (default: 14)', default: '14' },
      json:      { type: 'boolean', description: 'Emit JSON result', default: false },
    },
    async run({ args }) {
      const baseDir = resolveBaseDir(args);
      const days = parseInt(args.days || '14', 10) || 14;

      const baseline = computeBaseline({ baseDir, days });

      if (args.json) {
        process.stdout.write(JSON.stringify({ ok: true, baseline }, null, 2) + '\n');
        return;
      }

      console.log('\n=== gad anomalies baseline ===\n');
      console.log(`Lookback:      ${baseline.lookback_days} days`);
      console.log(`Samples:       ${baseline.sample_count} daily-spend datapoints`);
      console.log(`Median/day:    ${Math.round(baseline.median).toLocaleString()} tokens`);
      console.log(`StdDev/day:    ${Math.round(baseline.stddev).toLocaleString()} tokens`);
      console.log(`3-sigma upper: ${Math.round(baseline.p95_threshold).toLocaleString()} tokens (normal ceiling)`);
      console.log(`Spike thresh:  ${Math.round(baseline.p95_threshold * 3).toLocaleString()} tokens (3× normal ceiling = anomaly)`);
      console.log('');
    },
  });

  // ── root ──────────────────────────────────────────────────────────────────
  return defineCommand({
    meta: { name: 'anomalies', description: 'Detect and inspect ecosystem anomalies (token spend, process lifecycle, handoffs, log growth).' },
    subCommands: {
      list: listCmd,
      describe: describeCmd,
      baseline: baselineCmd,
    },
  });
}

module.exports = { createAnomaliesCommand };
module.exports.register = (ctx) => ({ anomalies: createAnomaliesCommand(ctx.common) });
