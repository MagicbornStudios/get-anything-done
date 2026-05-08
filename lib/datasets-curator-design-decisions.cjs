'use strict';
/**
 * lib/datasets-curator-design-decisions.cjs
 *
 * Curator extraction step for the "design-reasoning" label class.
 * Reads .planning/design-decisions/*.md and emits training tuples:
 *
 *   {
 *     kind:           "design-reasoning",
 *     label:          "design-reasoning",
 *     date:           YYYY-MM-DD,
 *     source_file:    <absolute path to .md>,
 *     id:             "dd-001",
 *     input:          <problem field>,
 *     target:         "<reasoning>\n\nFix: <fix>\n\nPrinciple: <principle>",
 *     refs:           [...],
 *     status:         "live" | "superseded" | "archived",
 *     training_ready: boolean,
 *     _curated_at:    ISO timestamp,
 *   }
 *
 * Called from datasets.cjs runTick() if .planning/design-decisions/ exists.
 * Writes to .planning/datasets/design-reasoning/<YYYY-MM-DD>.jsonl.
 *
 * Hardening:
 *   - mtime-cache skip: only re-processes files changed since last pass
 *   - dry-run aware: classifies but does not write
 *   - never throws: errors caught and logged; partial results still emitted
 */

const fs   = require('node:fs');
const path = require('node:path');

const { readDesignDecisions } = require('./design-decisions.cjs');

// Module-scoped mtime cache (preserved across repeated calls in same process)
const _mtimeCache = Object.create(null);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sourceChanged(filePath) {
  let mtime = 0;
  try { mtime = fs.statSync(filePath).mtimeMs; } catch (_) { return false; }
  const last = _mtimeCache[filePath] || 0;
  if (mtime > last) {
    _mtimeCache[filePath] = mtime;
    return true;
  }
  return false;
}

function isTrainingReady(tuple) {
  return Boolean(tuple.input && tuple.target && tuple.id && tuple.source_file);
}

/**
 * Run one design-reasoning extraction pass for a single planning directory.
 *
 * @param {object} params
 * @param {string} params.planningDir   — absolute path to .planning/
 * @param {(msg: string) => void} params.log
 * @param {boolean} [params.dryRun]
 * @returns {{ tuples_written: number, bytes_written: number, count: number }}
 */
function extractDesignReasoning({ planningDir, log, dryRun = false }) {
  const ddDir = path.join(planningDir, 'design-decisions');
  if (!fs.existsSync(ddDir)) {
    return { tuples_written: 0, bytes_written: 0, count: 0 };
  }

  const mode = dryRun ? '[dry-run] ' : '';
  let entries;
  try {
    entries = readDesignDecisions(planningDir);
  } catch (e) {
    log(`design-reasoning: error reading entries — ${e.message}`);
    return { tuples_written: 0, bytes_written: 0, count: 0 };
  }

  // Group tuples by date for buffer
  const buffer = Object.create(null); // date → string[]

  for (const entry of entries) {
    const filePath = entry._file;
    if (!filePath) continue;
    if (!sourceChanged(filePath)) continue;

    const date = entry.created_at
      ? String(entry.created_at).slice(0, 10)
      : todayIso();

    const target = [
      entry.reasoning,
      entry.fix    ? `Fix: ${entry.fix}`           : '',
      entry.principle ? `Principle: ${entry.principle}` : '',
    ].filter(Boolean).join('\n\n');

    const tuple = {
      kind:          'design-reasoning',
      label:         'design-reasoning',
      date,
      source_file:   filePath,
      id:            entry.id,
      input:         entry.problem,
      target,
      refs:          entry.refs || [],
      status:        entry.status || 'live',
      training_ready: false,
      _curated_at:   new Date().toISOString(),
    };
    tuple.training_ready = isTrainingReady(tuple);

    if (!buffer[date]) buffer[date] = [];
    buffer[date].push(JSON.stringify(tuple));
  }

  const totalLines = Object.values(buffer).reduce((n, arr) => n + arr.length, 0);
  log(`design-reasoning: ${mode}found ${entries.length} entries, ${totalLines} changed`);

  if (dryRun || totalLines === 0) {
    return { tuples_written: 0, bytes_written: 0, count: totalLines };
  }

  const datasetsRoot = path.join(planningDir, 'datasets', 'design-reasoning');
  fs.mkdirSync(datasetsRoot, { recursive: true });

  let tuplesWritten = 0;
  let bytesWritten  = 0;

  for (const [date, lines] of Object.entries(buffer)) {
    const outPath = path.join(datasetsRoot, `${date}.jsonl`);
    const content = lines.join('\n') + '\n';
    try {
      fs.appendFileSync(outPath, content, 'utf8');
      tuplesWritten += lines.length;
      bytesWritten  += Buffer.byteLength(content, 'utf8');
    } catch (e) {
      log(`design-reasoning: write error ${outPath} — ${e.message}`);
    }
  }

  log(`design-reasoning: wrote ${tuplesWritten} tuples (${bytesWritten}B)`);
  return { tuples_written: tuplesWritten, bytes_written: bytesWritten, count: totalLines };
}

module.exports = { extractDesignReasoning };
