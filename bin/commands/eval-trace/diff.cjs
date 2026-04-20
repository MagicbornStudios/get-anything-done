'use strict';

const fs = require('fs');
const { defineCommand } = require('citty');
const {
  FIDELITY_SCORE,
  loadTrace,
  computeCompleteness,
} = require('../../../lib/eval-trace-core.cjs');

function createEvalTraceDiffCommand({ listEvalProjectsHint, resolveOrDefaultEvalProjectDir, outputError, output }) {
  return defineCommand({
    meta: { name: 'diff', description: 'Diff unit coverage between two traced runs' },
    args: {
      v1: { type: 'positional', description: 'First version (e.g. v2)', required: false },
      v2: { type: 'positional', description: 'Second version (e.g. v3)', required: false },
      project: { type: 'string', description: 'Eval project name', default: '' },
    },
    run({ args }) {
      if (!args.project) { listEvalProjectsHint(); return; }
      if (!args.v1 || !args.v2) {
        console.error(`\nUsage: gad eval trace diff v1 v2 --project ${args.project || '<name>'}\n`);
        process.exit(1);
      }
      const projDir = resolveOrDefaultEvalProjectDir(args.project);
      if (!fs.existsSync(projDir)) { outputError(`Eval project '${args.project}' not found.`); return; }

      const t1 = loadTrace(projDir, args.v1);
      const t2 = loadTrace(projDir, args.v2);
      if (!t1) { console.error(`No TRACE.json for ${args.v1}.`); process.exit(1); }
      if (!t2) { console.error(`No TRACE.json for ${args.v2}.`); process.exit(1); }

      const cov1 = t1.unit_coverage || {};
      const cov2 = t2.unit_coverage || {};
      const allUnits = [...new Set([...Object.keys(cov1), ...Object.keys(cov2)])].sort();

      const rows = allUnits.map((u) => {
        const f1 = cov1[u] || 'Absent';
        const f2 = cov2[u] || 'Absent';
        const s1 = FIDELITY_SCORE[f1] ?? 0;
        const s2 = FIDELITY_SCORE[f2] ?? 0;
        const change = s2 > s1 ? 'up' : s2 < s1 ? 'down' : '=';
        return { unit: u, [args.v1]: f1, [args.v2]: f2, change };
      });

      console.log(`\nTrace diff: ${args.project}  ${args.v1} -> ${args.v2}\n`);
      output(rows, {});

      const c1 = computeCompleteness(cov1);
      const c2 = computeCompleteness(cov2);
      const tok1 = t1.totals?.tokens ?? '-';
      const tok2 = t2.totals?.tokens ?? '-';
      console.log(`\nCompleteness: ${c1?.toFixed(3) ?? '-'} -> ${c2?.toFixed(3) ?? '-'}`);
      console.log(`Tokens:       ${tok1} -> ${tok2}`);

      const improved = rows.filter((r) => r.change === 'up').length;
      const regressed = rows.filter((r) => r.change === 'down').length;
      console.log(`Units improved: ${improved}  regressed: ${regressed}`);
      console.log('');
    },
  });
}

module.exports = { createEvalTraceDiffCommand };
