'use strict';
/**
 * lib/sitrep-digest.cjs — SITREP digest writer (GLOBAL-D-315 / task 75-14).
 *
 * Writes `.planning/.sitrep.md` with a tight operator-readable status
 * snapshot covering: dispatcher, workers, accounts, daemons, open handoffs,
 * recent failures, recent commits, and top-3 models by recent CLI calls.
 *
 * Called by the overnight daemon on each tick (every 30 min) and
 * on-demand via `gad sitrep --tick`.
 *
 * Design rules:
 *  - File-system reads only. No subprocess spawns, no auth.
 *  - Reuses rollupDispatcher / rollupWorkers / rollupAccounts / rollupDaemons
 *    from snapshot-health-rollup.cjs — never duplicate.
 *  - Safe to call concurrently with snapshot; writes are atomic (tmp rename).
 */

const fs = require('fs');
const path = require('path');
const {
  rollupDispatcher,
  rollupWorkers,
  rollupAccounts,
  rollupDaemons,
} = require('./snapshot-health-rollup.cjs');

// ─── helpers ─────────────────────────────────────────────────────────────────

function ts() { return new Date().toISOString(); }

function countOpenHandoffs(baseDir) {
  try {
    const dir = path.join(baseDir, '.planning', 'handoffs', 'open');
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.json')).length;
  } catch { return 0; }
}

function countRecentFailures(baseDir) {
  // Count entries in ERRORS-AND-ATTEMPTS.xml written in last 24h.
  try {
    const p = path.join(baseDir, '.planning', 'ERRORS-AND-ATTEMPTS.xml');
    if (!fs.existsSync(p)) return 0;
    const mtime = fs.statSync(p).mtimeMs;
    if (Date.now() - mtime > 7 * 24 * 3600_000) return 0;  // stale file
    const text = fs.readFileSync(p, 'utf8');
    // Each entry is wrapped in <entry …> or <entry>
    const matches = text.match(/<entry\b/g);
    return matches ? matches.length : 0;
  } catch { return 0; }
}

function countRecentCommits(baseDir) {
  // Count lines in git COMMIT_EDITMSG or use reflog if accessible.
  // No subprocess — count reflog entries written in last 24h.
  try {
    const reflogPath = path.join(baseDir, '.git', 'logs', 'HEAD');
    if (!fs.existsSync(reflogPath)) return 0;
    const cutoff = Date.now() - 24 * 3600_000;
    const lines = fs.readFileSync(reflogPath, 'utf8').split('\n').filter(Boolean);
    let count = 0;
    for (const line of lines) {
      // reflog timestamp field: "<sp><timestamp-unix><sp><+tz>" embedded in line
      const m = line.match(/\s(\d{10})\s[+-]\d{4}\s+commit/);
      if (m) {
        const epochMs = parseInt(m[1], 10) * 1000;
        if (epochMs >= cutoff) count++;
      }
    }
    return count;
  } catch { return 0; }
}

/**
 * Read top-3 models by call count from the current day's .gad-log file.
 * Falls back gracefully (returns empty list) if not present or parsing fails.
 */
function topModels(baseDir) {
  try {
    const logDir = path.join(baseDir, '.planning', '.gad-log');
    if (!fs.existsSync(logDir)) return [];
    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `${today}.jsonl`);
    if (!fs.existsSync(logFile)) return [];
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    const counts = {};
    for (const line of lines) {
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      // gad-log rows carry chosen_model (routing-decision) or model (call row)
      const model = row.chosen_model || row.model || null;
      if (!model || typeof model !== 'string') continue;
      counts[model] = (counts[model] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([m, n]) => `${m}(${n})`);
  } catch { return []; }
}

// ─── digest composer ─────────────────────────────────────────────────────────

function buildDigest(baseDir, projectid) {
  const now = ts();

  // --- dispatcher ---
  const disp = (() => {
    try { return rollupDispatcher(baseDir); } catch { return { state: 'UNKNOWN' }; }
  })();
  const dState = disp.state || 'UNKNOWN';
  const dAge = typeof disp.age_s === 'number' ? ` age=${disp.age_s}s` : '';
  const dFlag = (dState === 'DEAD' || dState === 'STALE') ? ' [!]' : '';
  const dispLine = `Dispatcher: ${dState}${dFlag}${dAge}  pid=${disp.pid || '-'}`;

  // --- workers ---
  const wrk = (() => {
    try { return rollupWorkers(baseDir); } catch { return { tally: null, stale: [] }; }
  })();
  let workerLine = 'Workers:    (no team config)';
  if (wrk.tally) {
    const t = wrk.tally;
    const parts = [`total=${t.total}`, `working=${t.working}`, `idle=${t.idle}`];
    if (t.claiming) parts.push(`claiming=${t.claiming}`);
    if (t.stopped) parts.push(`stopped=${t.stopped}`);
    if (t.not_started) parts.push(`not_started=${t.not_started}`);
    workerLine = `Workers:    ${parts.join(' ')}`;
    if (wrk.stale && wrk.stale.length) workerLine += `  stale=[${wrk.stale.join(',')}]`;
  }

  // --- accounts ---
  const acc = (() => {
    try { return rollupAccounts(baseDir); } catch { return { _error: 'read failed' }; }
  })();
  let accountLine = 'Accounts:   (none)';
  if (acc && !acc._error) {
    const parts = Object.entries(acc).map(([prov, c]) => {
      const flags = [];
      if (c.exhausted > 0) flags.push(`exhausted=${c.exhausted}`);
      if (c.paused > 0) flags.push(`paused=${c.paused}`);
      if (c.last_error) flags.push(`err=${c.last_error}`);
      return flags.length ? `${prov}=${c.active}[${flags.join(' ')}]` : `${prov}=${c.active}`;
    });
    if (parts.length) accountLine = `Accounts:   ${parts.join('  ')}`;
  } else if (acc && acc._error) {
    accountLine = `Accounts:   error(${acc._error})`;
  }

  // --- daemons ---
  const daemons = (() => {
    try { return rollupDaemons(baseDir); } catch { return []; }
  })();
  const daemonLine = 'Daemons:    ' + (daemons.length
    ? daemons.map((d) => `${d.id}=${d.alive ? 'UP' : (d.exists ? 'STALE-PID' : 'OFF')}`).join('  ')
    : '(none)');

  // --- counters ---
  const openHandoffs = countOpenHandoffs(baseDir);
  const recentFailures = countRecentFailures(baseDir);
  const recentCommits = countRecentCommits(baseDir);

  const countersLine = `Handoffs(open)=${openHandoffs}  Errors(total-logged)=${recentFailures}  Commits(24h)=${recentCommits}`;

  // --- models ---
  const models = topModels(baseDir);
  const modelLine = models.length ? `Top models: ${models.join('  ')}` : '';

  const lines = [
    `# SITREP — ${now}  project=${projectid || 'global'}`,
    '',
    dispLine,
    workerLine,
    accountLine,
    daemonLine,
    countersLine,
  ];
  if (modelLine) lines.push(modelLine);

  return lines.join('\n') + '\n';
}

// ─── writer ──────────────────────────────────────────────────────────────────

const SITREP_FILE = '.sitrep.md';

/**
 * Write (or overwrite) `.planning/.sitrep.md` atomically.
 *
 * @param {string} baseDir   — monorepo root (findRepoRoot() result)
 * @param {string} projectid — planning project id (e.g. 'global')
 */
function writeSitrepDigest(baseDir, projectid) {
  const planningDir = path.join(baseDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  const dest = path.join(planningDir, SITREP_FILE);
  const tmp = dest + '.tmp.' + process.pid;
  const content = buildDigest(baseDir, projectid);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, dest);
  return dest;
}

module.exports = { writeSitrepDigest, buildDigest, SITREP_FILE };
