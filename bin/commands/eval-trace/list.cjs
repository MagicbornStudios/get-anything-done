'use strict';

const fs = require('fs');
const { defineCommand } = require('citty');
const {
  loadTrace,
  computeCompleteness,
} = require('../../../lib/eval-trace-core.cjs');

function createEvalTraceListCommand({ listAllEvalProjects, outputError, output }) {
  return defineCommand({
    meta: { name: 'list', description: 'List eval runs that have a TRACE.json' },
    args: { project: { type: 'string', description: 'Eval project name (default: all)', default: '' } },
    run({ args }) {
      let allProjects;
      try { allProjects = listAllEvalProjects(); }
      catch (err) { outputError(err.message); return; }
      if (allProjects.length === 0) { console.log('No eval projects found.'); return; }

      const selected = args.project ? allProjects.filter((p) => p.name === args.project) : allProjects;
      const rows = [];
      for (const { name: proj, projectDir: projDir } of selected) {
        if (!fs.existsSync(projDir)) continue;
        const runs = fs.readdirSync(projDir, { withFileTypes: true })
          .filter((r) => r.isDirectory() && /^v\d+$/.test(r.name))
          .map((r) => r.name)
          .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        for (const v of runs) {
          const trace = loadTrace(projDir, v);
          if (!trace) {
            rows.push({ project: proj, version: v, workflow: '-', completeness: '-', tokens: '-', traced: 'no' });
            continue;
          }
          const completeness = trace.totals?.completeness ?? computeCompleteness(trace.unit_coverage ?? {});
          rows.push({
            project: proj,
            version: v,
            workflow: trace.workflow || '-',
            completeness: completeness != null ? completeness.toFixed(3) : '-',
            tokens: trace.totals?.tokens ?? '-',
            traced: 'yes',
          });
        }
      }

      output(rows, { title: 'Eval Traces' });
      const traced = rows.filter((r) => r.traced === 'yes').length;
      console.log(`\n${traced}/${rows.length} run(s) have traces.  Missing: run \`gad eval trace write\` after each run.`);
    },
  });
}

module.exports = { createEvalTraceListCommand };
