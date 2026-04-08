'use strict';

/**
 * Watch .planning/ directories for changes and re-run refs verify.
 * Emits structured JSON lines for each verify run.
 *
 * Usage:
 *   const { startWatch } = require('./watch-planning.cjs');
 *   startWatch(repoRoot, { debounceMs: 500, poll: false });
 */

const fs = require('fs');
const path = require('path');
const { verifyPlanningXmlRefs, listPlanningXmlFiles } = require('./planning-ref-verify.cjs');

/**
 * Find all .planning/ directories under repoRoot.
 * @param {string} repoRoot
 * @returns {string[]}
 */
function findPlanningDirs(repoRoot) {
  const dirs = new Set();
  const xmlFiles = listPlanningXmlFiles(repoRoot);
  for (const f of xmlFiles) {
    // Walk up to find the .planning/ directory
    let dir = path.dirname(f);
    while (dir.length > repoRoot.length) {
      if (path.basename(dir) === '.planning') {
        dirs.add(dir);
        break;
      }
      dir = path.dirname(dir);
    }
  }
  return [...dirs];
}

/**
 * Run verify and emit a JSON summary line.
 * @param {string} repoRoot
 * @param {string} trigger - what caused this run ('init', 'change', 'poll')
 * @param {function} emit - callback that receives the JSON object
 */
function runVerify(repoRoot, trigger, emit) {
  const start = Date.now();
  const result = verifyPlanningXmlRefs(repoRoot);
  const duration = Date.now() - start;

  const summary = {
    ts: new Date().toISOString(),
    trigger,
    ok: result.ok,
    xml_files: result.xmlFileCount,
    missing: result.missing.length,
    duration_ms: duration,
  };

  if (!result.ok) {
    summary.missing_paths = result.missing.slice(0, 10).map(m => ({
      file: m.file,
      path: m.path,
    }));
  }

  emit(summary);
  return summary;
}

/**
 * Start watching .planning/ directories.
 * @param {string} repoRoot
 * @param {object} opts
 * @param {number} [opts.debounceMs=500]
 * @param {boolean} [opts.poll=false]
 * @param {function} [opts.emit] - custom emit function (default: console.log JSON)
 * @returns {{ stop: function }}
 */
function startWatch(repoRoot, opts = {}) {
  const debounceMs = opts.debounceMs || 500;
  const usePoll = opts.poll || false;
  const emit = opts.emit || ((obj) => console.log(JSON.stringify(obj)));

  const planningDirs = findPlanningDirs(repoRoot);

  if (planningDirs.length === 0) {
    emit({ ts: new Date().toISOString(), trigger: 'init', ok: false, error: 'no .planning/ directories found' });
    return { stop: () => {} };
  }

  // Initial run
  runVerify(repoRoot, 'init', emit);

  // Set up watchers
  let debounceTimer = null;
  const watchers = [];

  const scheduleVerify = (trigger) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runVerify(repoRoot, trigger, emit);
    }, debounceMs);
  };

  for (const dir of planningDirs) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.xml') || filename.endsWith('.md'))) {
          scheduleVerify('change');
        }
      });
      watchers.push(watcher);
    } catch (e) {
      // fs.watch may fail on some platforms — fall back to poll
      if (!usePoll) {
        emit({ ts: new Date().toISOString(), trigger: 'error', error: `fs.watch failed on ${dir}: ${e.message}. Use --poll.` });
      }
    }
  }

  // Optional polling fallback
  let pollInterval = null;
  if (usePoll) {
    pollInterval = setInterval(() => {
      runVerify(repoRoot, 'poll', emit);
    }, Math.max(debounceMs * 4, 2000));
  }

  emit({
    ts: new Date().toISOString(),
    trigger: 'watching',
    dirs: planningDirs.length,
    mode: usePoll ? 'poll' : 'fs.watch',
    debounce_ms: debounceMs,
  });

  return {
    stop: () => {
      for (const w of watchers) w.close();
      if (pollInterval) clearInterval(pollInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
    },
  };
}

module.exports = { startWatch, runVerify, findPlanningDirs };
