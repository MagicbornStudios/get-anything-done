'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { historyPath, reportsDir } = require('../../../lib/delta-train/paths.cjs');

module.exports = defineCommand({
  meta: {
    name: 'report',
    description: 'Generate a morning report from the delta-training history.',
  },
  args: {
    since: { type: 'string', description: 'Look back duration (e.g. 8h, 1d)', default: '8h' },
    projectid: { type: 'string', description: 'Project to check', default: 'global' },
  },
  run({ args }) {
    const baseDir = process.cwd();
    const p = historyPath(baseDir);
    if (!fs.existsSync(p)) {
      console.log('No history found.');
      return;
    }

    function parseDuration(s) {
      const m = s.match(/^(\d+)([hdm])$/);
      if (!m) return 8 * 3600000;
      const val = parseInt(m[1], 10);
      const unit = m[2];
      if (unit === 'h') return val * 3600000;
      if (unit === 'd') return val * 24 * 3600000;
      if (unit === 'm') return val * 60000;
      return 8 * 3600000;
    }

    const durationMs = parseDuration(args.since);
    const sinceTs = Date.now() - durationMs;

    const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
    const allRecords = lines.map((l) => JSON.parse(l));
    const records = allRecords.filter((r) => Date.parse(r.ended_at) >= sinceTs);

    if (records.length === 0) {
      console.log(`No records found in the last ${args.since}.`);
      return;
    }

    const promotions = records.filter((r) => r.outcome === 'promoted');
    const discards = records.filter((r) => r.outcome === 'discarded');
    const errors = records.filter((r) => r.outcome === 'errored');
    const skips = records.filter((r) => r.outcome === 'skipped');

    const reportDate = new Date().toISOString().split('T')[0];
    const reportPath = path.join(reportsDir(baseDir), `${reportDate}.md`);
    if (!fs.existsSync(path.dirname(reportPath))) fs.mkdirSync(path.dirname(reportPath), { recursive: true });

    let md = `# Delta-Training Morning Report — ${reportDate}\n\n`;
    md += `**Window:** Last ${args.since} (${records.length} ticks)\n\n`;
    md += `## Summary\n\n`;
    md += `- **Promotions:** ${promotions.length}\n`;
    md += `- **Discards:**   ${discards.length}\n`;
    md += `- **Errors:**     ${errors.length}\n`;
    md += `- **Skips:**      ${skips.length}\n\n`;

    md += `## Ticks\n\n`;
    md += `| Time | Outcome | Envelopes | Reason / Info |\n`;
    md += `|---|---|---|---|\n`;
    for (const r of records) {
      const ts = r.ended_at ? r.ended_at.replace('T', ' ').slice(11, 16) : '??:??';
      const outcome = r.outcome || 'unknown';
      const envelopes = r.input_envelopes || 0;
      const reason = r.reason || '';
      md += `| ${ts} | ${outcome} | ${envelopes} | ${reason} |\n`;
    }

    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`Report generated: ${reportPath}`);
    console.log(md);
  },
});
