'use strict';
/**
 * sources/bench-results.cjs — ingest .planning/bench-results/*.json into context index.
 *
 * Normalises each result to:
 *   { id, text: "Bench result <set> <contestant> ELO N pass M/T", source: 'bench-results', ts }
 *
 * No ELO math is performed here (pure context text); ELO is computed on-demand
 * by `gad bench elo`. The text includes the pass ratio so BM25 queries like
 * "bench pass seed-coding-mini" surface relevant results.
 *
 * Phase 247 / GLOBAL-T-247-17.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {string} projectRoot
 * @param {object} opts
 * @param {string|null} opts.since  ISO timestamp — skip results older than this
 * @returns {Array<{id, text, source, ts}>}
 */
function ingestBenchResults(projectRoot, opts = {}) {
  const resultsDir = path.join(projectRoot, '.planning', 'bench-results');
  if (!fs.existsSync(resultsDir)) return [];

  const since = opts.since ? new Date(opts.since).getTime() : 0;
  let files;
  try {
    files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json')).sort();
  } catch {
    return [];
  }

  const records = [];

  for (const f of files) {
    const filePath = path.join(resultsDir, f);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }

    const ts = raw.ts || null;
    if (ts && since && new Date(ts).getTime() < since) continue;

    const setId = raw.set || 'unknown-set';
    const contestantId = (raw.contestant && raw.contestant.id) ? raw.contestant.id : 'unknown-contestant';

    let passRatio = '';
    if (raw.summary) {
      const { passed, problems } = raw.summary;
      passRatio = ` pass ${passed}/${problems}`;
    }

    // ELO placeholder — individual results don't carry ELO; use N/A here.
    const text = `Bench result ${setId} ${contestantId} ELO N/A${passRatio}`;

    records.push({
      id: `bench-results:${raw.id || f.replace(/\.json$/, '')}`,
      text,
      source: 'bench-results',
      ts: ts || new Date(0).toISOString(),
    });
  }

  return records;
}

module.exports = { ingestBenchResults };
