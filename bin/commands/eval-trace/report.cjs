'use strict';

const fs = require('fs');
const { defineCommand } = require('citty');
const {
  FIDELITY_SCORE,
  ALL_UNITS,
  UNIT_LABELS,
  loadTrace,
  computeCompleteness,
} = require('../../../lib/eval-trace-core.cjs');

function createEvalTraceReportCommand({ listEvalProjectsHint, resolveOrDefaultEvalProjectDir, outputError, output, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'report', description: 'Aggregate trace stats across all runs for a project' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

      const traced = runs.map((v) => ({ v, trace: loadTrace(projDir, v) })).filter((r) => r.trace);
      if (traced.length === 0) {
        console.log(`No traces found for '${args.project}'. Run \`gad eval trace write\` after each eval run.`);
        return;
      }

      const unitTrend = {};
      for (const u of ALL_UNITS) {
        unitTrend[u] = traced.map(({ v, trace }) => ({
          v,
          fidelity: trace.unit_coverage?.[u] || 'Absent',
          score: FIDELITY_SCORE[trace.unit_coverage?.[u]] ?? 0,
        }));
      }

      if (args.json || shouldUseJson()) {
        const out = {
          project: args.project,
          runs: traced.map(({ v, trace }) => ({
            version: v,
            workflow: trace.workflow,
            tokens: trace.totals?.tokens,
            completeness: trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {}),
          })),
          unitTrend,
        };
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      console.log(`\nTrace Report: ${args.project}  (${traced.length} traced runs)\n`);

      const summaryRows = traced.map(({ v, trace }) => {
        const c = trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {});
        return { version: v, workflow: trace.workflow || '-', completeness: c?.toFixed(3) ?? '-', tokens: trace.totals?.tokens ?? '-' };
      });
      output(summaryRows, { title: 'Run Summary' });

      console.log(`\nUnit Fidelity Trend\n${'-'.repeat(60)}`);
      const problemUnits = ALL_UNITS.filter((u) => {
        const scores = unitTrend[u].map((t) => t.score);
        return scores.some((s) => s < 1.0);
      });

      for (const u of problemUnits) {
        const trend = unitTrend[u].map((t) => `${t.v}:${t.fidelity[0]}`).join('  ');
        const latest = unitTrend[u][unitTrend[u].length - 1]?.fidelity || 'Absent';
        console.log(`  ${u}  ${UNIT_LABELS[u]?.slice(0, 28).padEnd(28)}  ${trend}  (latest: ${latest})`);
      }
      if (problemUnits.length === 0) console.log('  All units at Full/Referenced across all traced runs.');
      console.log('');
    },
  });
}

module.exports = { createEvalTraceReportCommand };
