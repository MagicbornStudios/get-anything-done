'use strict';
/**
 * lib/team/dispatcher.cjs — fs.watch-based handoff dispatcher.
 *
 * Watches `.planning/handoffs/open/` for new handoff files. On create or
 * rename events, runs one `dispatchOnce` pass: scan all open handoffs, find
 * any not yet present in a worker mailbox, assign the best match based on
 * lane + runtime_preference + least-loaded worker. Drops a .msg.json into
 * the chosen mailbox.
 *
 * Cheaper + faster than worker polling: fs.watch is kernel-notified,
 * handoff-arrival → dispatch latency is typically < 100ms.
 *
 * Daemon loop is separate from the dispatch logic so a one-shot
 * `gad team dispatch` call reuses `dispatchOnce`.
 */

const fs = require('fs');
const path = require('path');
const { readJsonSafe, appendJsonl } = require('./io.cjs');
const { readConfig, workerSpec } = require('./config.cjs');
const { listWorkerIds } = require('./status.cjs');
const { mailboxDepth, listMailboxRefs, enqueueMessage } = require('./mailbox.cjs');
const { matchesLane } = require('./lanes.cjs');
const { teamRoot } = require('./paths.cjs');

function dispatcherPidPath(baseDir) { return path.join(teamRoot(baseDir), 'dispatcher.pid'); }
function dispatcherLogPath(baseDir) { return path.join(teamRoot(baseDir), 'dispatcher.log.jsonl'); }

function writePid(baseDir, pid) {
  fs.mkdirSync(teamRoot(baseDir), { recursive: true });
  fs.writeFileSync(dispatcherPidPath(baseDir), JSON.stringify({ pid, started_at: new Date().toISOString() }));
}
function readPid(baseDir) { return readJsonSafe(dispatcherPidPath(baseDir), null); }
function clearPid(baseDir) { try { fs.unlinkSync(dispatcherPidPath(baseDir)); } catch {} }

function pidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function loadLibs() {
  const handoffs = require('../handoffs.cjs');
  const agentDetect = require('../agent-detect.cjs');
  return { handoffs, agentDetect };
}

/**
 * One dispatch pass. Returns { assigned, skipped } counts.
 * `logWrite` receives one entry per decision.
 */
function dispatchOnce(baseDir, logWrite) {
  const cfg = readConfig(baseDir);
  if (!cfg) return { assigned: 0, skipped: 0, reason: 'no-team-config' };
  const ids = listWorkerIds(baseDir);
  if (ids.length === 0) return { assigned: 0, skipped: 0, reason: 'no-workers' };

  const { handoffs, agentDetect } = loadLibs();
  const open = handoffs.listHandoffs({ baseDir, bucket: 'open' });
  const queued = listMailboxRefs(baseDir, ids);
  const candidates = open.filter(h => !queued.has(h.id));
  if (candidates.length === 0) return { assigned: 0, skipped: 0, reason: 'nothing-new' };

  const sorted = agentDetect.sortHandoffsForPickup(candidates, cfg.runtime || null);
  let assigned = 0;
  let skipped = 0;

  for (const h of sorted) {
    const hlane = h.frontmatter && h.frontmatter.lane;
    const runtimePref = h.frontmatter && h.frontmatter.runtime_preference;

    const pool = ids
      .map(id => ({ id, spec: workerSpec(cfg, id), depth: mailboxDepth(baseDir, id) }))
      .filter(w => matchesLane(w.spec.lane, hlane))
      .filter(w => agentDetect.isHandoffCompatible(runtimePref, w.spec.runtime));

    if (pool.length === 0) {
      if (logWrite) logWrite({ kind: 'skip', ref: h.id, reason: 'no-matching-worker', lane: hlane, runtime_preference: runtimePref });
      skipped++;
      continue;
    }
    pool.sort((a, b) => a.depth - b.depth);
    const target = pool[0].id;

    const msg = {
      kind: 'handoff', ref: h.id,
      projectid: (h.frontmatter && h.frontmatter.projectid) || null,
      priority: (h.frontmatter && h.frontmatter.priority) || 'normal',
      runtime_preference: runtimePref || null,
      enqueued_at: new Date().toISOString(),
      enqueued_by: 'dispatcher',
    };
    enqueueMessage(baseDir, target, msg);
    if (logWrite) logWrite({ kind: 'assign', ref: h.id, worker_id: target, priority: msg.priority, lane: hlane });
    assigned++;
  }

  return { assigned, skipped };
}

/**
 * Run the daemon loop. Blocks forever. Respects SIGTERM / SIGINT to exit
 * cleanly. Uses fs.watch on the open/ directory — one watcher, cheap.
 *
 * Also runs a safety poll every 10s as a backup in case fs.watch misses an
 * event on some filesystem (Windows / network shares can be flaky).
 */
async function runDaemon(baseDir) {
  const openDir = path.join(baseDir, '.planning', 'handoffs', 'open');
  fs.mkdirSync(openDir, { recursive: true });

  writePid(baseDir, process.pid);
  const logWrite = (entry) => appendJsonl(dispatcherLogPath(baseDir), { ts: new Date().toISOString(), ...entry });
  logWrite({ kind: 'start', pid: process.pid, watch_dir: openDir });

  let stopping = false;
  let pending = false;
  let inFlight = false;

  async function tick() {
    if (stopping) return;
    if (inFlight) { pending = true; return; }
    inFlight = true;
    try {
      const result = dispatchOnce(baseDir, logWrite);
      if (result.assigned > 0 || result.skipped > 0 || result.reason) {
        // Only log pass-summaries when something changed or we hit a known no-op reason.
        logWrite({ kind: 'pass', ...result });
      }
    } catch (err) {
      logWrite({ kind: 'error', error: err.message, stack: (err.stack || '').split('\n').slice(0, 4).join(' | ') });
    } finally {
      inFlight = false;
      if (pending) { pending = false; setImmediate(tick); }
    }
  }

  let watcher;
  try {
    watcher = fs.watch(openDir, { persistent: true }, () => tick());
    logWrite({ kind: 'watching' });
  } catch (err) {
    logWrite({ kind: 'watch-error', error: err.message });
  }

  // Safety poll — catches any events fs.watch missed
  const pollMs = 10_000;
  const pollTimer = setInterval(tick, pollMs);

  // First pass on startup
  await tick();

  // Graceful shutdown
  const stop = (signal) => {
    stopping = true;
    logWrite({ kind: 'stop', signal });
    try { watcher && watcher.close(); } catch {}
    clearInterval(pollTimer);
    clearPid(baseDir);
    process.exit(0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  // Keep alive
  await new Promise(() => {});
}

module.exports = {
  dispatchOnce,
  runDaemon,
  dispatcherPidPath,
  dispatcherLogPath,
  readPid,
  clearPid,
  pidAlive,
};
