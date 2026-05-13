'use strict';

const fs = require('fs');
const { defineCommand } = require('citty');
const { historyPath } = require('../../../lib/delta-train/paths.cjs');

module.exports = defineCommand({
  meta: {
    name: 'history',
    description: 'Show the history of the delta-training loop.',
  },
  args: {
    last: { type: 'string', description: 'Number of recent records to show', default: '10' },
    outcome: { type: 'string', description: 'Filter by outcome (promoted|discarded|skipped|errored)' },
    projectid: { type: 'string', description: 'Project to check', default: 'global' },
  },
  run({ args }) {
    const baseDir = process.cwd();
    const p = historyPath(baseDir);
    if (!fs.existsSync(p)) {
      console.log('No history found.');
      return;
    }

    const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
    let records = lines.map((l) => JSON.parse(l));

    if (args.outcome) {
      records = records.filter((r) => r.outcome === args.outcome);
    }

    const lastN = parseInt(args.last, 10);
    records = records.slice(-lastN);

    console.log(`\n=== Delta-Training History (Last ${records.length}) ===\n`);
    console.log('Timestamp            Outcome    Reason / Info');
    console.log('------------------------------------------------------------');
    for (const r of records) {
      const ts = r.ended_at ? r.ended_at.replace('T', ' ').slice(5, 16) : '??-?? ??:??';
      const outcome = (r.outcome || 'unknown').padEnd(10);
      const reason = r.reason || (r.input_envelopes != null ? `${r.input_envelopes} envelopes` : '');
      console.log(`${ts}  ${outcome} ${reason}`);
    }
    console.log('');
  },
});
