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

function createEvalTraceShowCommand({ listEvalProjectsHint, resolveOrDefaultEvalProjectDir, outputError, output, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'show', description: 'Show TRACE.json for an eval run' },
    args: {
      project: { type: 'string', description: 'Eval project name', default: '' },
      version: { type: 'string', description: 'Version (default: latest)', default: '' },
      json: { type: 'boolean', description: 'Raw JSON output', default: false },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const runs = fs.readdirSync(projDir, { withFileTypes: true })
        .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
        .map((r) => r.name)
        .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
      if (runs.length === 0) { outputError(`No runs found for '${args.project}'.`); return; }

      const version = args.version || runs[runs.length - 1];
      if (!runs.includes(version)) { outputError(`Version '${version}' not found. Available: ${runs.join(', ')}`); return; }

      const trace = loadTrace(projDir, version);
      if (!trace) {
        console.log(`No TRACE.json for ${args.project} ${version}.`);
        console.log(`Write one with: gad eval trace write --project ${args.project} --version ${version}`);
        return;
      }

      if (args.json || shouldUseJson()) { console.log(JSON.stringify(trace, null, 2)); return; }

      console.log(`\nTrace: ${args.project}  ${version}  (workflow ${trace.workflow || '?'})`);
      console.log(`Recorded: ${trace.recorded || '-'}  Method version: ${trace.methodology_version || '-'}\n`);

      console.log(`Unit Coverage\n${'-'.repeat(60)}`);
      const cov = trace.unit_coverage || {};
      const unitRows = ALL_UNITS.filter((u) => cov[u] || trace.commands?.some((c) => c.units?.[u])).map((u) => ({
        unit: u,
        description: UNIT_LABELS[u] || '?',
        fidelity: cov[u] || '-',
        score: cov[u] ? FIDELITY_SCORE[cov[u]] ?? '?' : '-',
      }));
      if (unitRows.length > 0) output(unitRows, {});

      if (trace.commands?.length > 0) {
        console.log(`\nCommands / Reads  (${trace.commands.length} total)\n${'-'.repeat(60)}`);
        for (const c of trace.commands) {
          const label = c.type === 'cli' ? `CLI  ${c.cmd}` : `FILE ${c.path}`;
          const units = c.units ? `  [${Object.keys(c.units).join(', ')}]` : '';
          console.log(`  ${c.seq}. ${label}  ${c.tokens ?? '?'}tok${units}`);
        }
      }

      if (trace.totals) {
        const t = trace.totals;
        const c = t.completeness != null ? t.completeness.toFixed(3) : computeCompleteness(cov)?.toFixed(3) ?? '-';
        console.log(`\nTotals: ${t.chars ?? '-'} chars / ${t.tokens ?? '-'} tokens`);
        console.log(`  full=${t.units_full ?? '-'}  partial=${t.units_partial ?? '-'}  absent=${t.units_absent ?? '-'}  completeness=${c}`);
      }
      console.log('');
    },
  });
}

module.exports = { createEvalTraceShowCommand };
