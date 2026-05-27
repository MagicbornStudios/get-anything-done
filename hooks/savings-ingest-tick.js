#!/usr/bin/env node
// gad-hook-version: {{GAD_VERSION}}
// @source-of-truth: tools/gad-cli/hooks/savings-ingest-tick.js
// @deployed-to: ~/.claude/hooks/savings-ingest-tick.js, vendor/get-anything-done/hooks/savings-ingest-tick.js
// @sync-via: gad install hooks
// @do-not-edit-copies: edit this file then run sync
'use strict';

const { findRepoRoot, collectMiddlewareSavings, appendUniqueLedgerRows, summarizeSavingsRows } = require('../lib/savings/aggregate.cjs');
const { ingestRtkSavings } = require('../lib/savings/ingest-rtk.cjs');
const { ingestCavemanSavings } = require('../lib/savings/ingest-caveman.cjs');
const os = require('node:os');

function runSavingsIngestTick(opts = {}) {
  const repoRoot = opts.repoRoot || findRepoRoot();
  const homeDir = opts.homeDir || os.homedir();
  const rows = [
    ...ingestRtkSavings({ homeDir }),
    ...ingestCavemanSavings({ homeDir, repoRoot }),
    ...collectMiddlewareSavings(repoRoot),
  ];
  const result = appendUniqueLedgerRows(repoRoot, rows);
  const summary = summarizeSavingsRows(rows);
  return {
    ok: true,
    source: 'all',
    ingested: rows.length,
    appended: result.appended.length,
    skipped: result.skipped,
    ledger_path: result.ledgerPath,
    total_tokens: summary.total_tokens,
    total_usd: summary.total_usd,
  };
}

function main() {
  try {
    const result = runSavingsIngestTick();
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    process.stderr.write(`[savings-ingest-tick] ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runSavingsIngestTick,
};
