'use strict';
/**
 * gad team status — table or JSON view of every worker.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');
const { readConfig } = require('../../../lib/team/config.cjs');
const { listWorkerIds, readStatus } = require('../../../lib/team/status.cjs');
const { mailboxDepth } = require('../../../lib/team/mailbox.cjs');
const { readHeartbeat } = require('../../../lib/team/dispatcher.cjs');
const { checkAndLogRestart } = require('../../../lib/team/restart-log.cjs');
const { getCooldownRemainingMs } = require('../../../lib/team/rate-limit.cjs');
const { listHandoffs } = require('../../../lib/handoffs.cjs');

// Invariant alarm thresholds (operator standing rule, 2026-05-09):
// claimed_handoff_count MUST NOT exceed live_team_worker_count + N_external_agents.
// Today's incident: 55 claimed handoffs, 9 zombie workers.
const LIVE_HEARTBEAT_THRESHOLD_S = 5 * 60;       // 5 min — worker considered live
const STALE_CLAIM_THRESHOLD_S = 6 * 60 * 60;     // 6 h  — claimed handoff considered stale
const LIVE_STATES = new Set(['RUNNING', 'IDLE', 'WORKING']);

function ageSeconds(tsIso) {
  if (!tsIso) return Infinity;
  const t = Date.parse(tsIso);
  if (!Number.isFinite(t)) return Infinity;
  return Math.floor((Date.now() - t) / 1000);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'unknown';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d${Math.floor((seconds % 86400) / 3600)}h`;
}

/**
 * Compute the team-status invariant warnings for a given baseDir + worker rows.
 * Pure function: no I/O beyond the listHandoffs call (which is fs-injectable).
 *
 * Returns an array of warning records:
 *   { kind: 'claims_exceed_capacity', claimed, live_workers, excess }
 *   { kind: 'oldest_stale_claim', ref, claimed_by, age_seconds, threshold_seconds }
 *   { kind: 'zombie_workers', count, ids }
 */
function computeWarnings({ baseDir, workerRows, externalAgents = 0, fsImpl, now = Date.now() } = {}) {
  const warnings = [];

  // Live workers — state in LIVE_STATES AND last_heartbeat within 5 min.
  const liveWorkers = (workerRows || []).filter((r) => {
    if (!LIVE_STATES.has(String(r.state || '').toUpperCase())) return false;
    const ageS = typeof r.heartbeat_age_s === 'number' ? r.heartbeat_age_s : Infinity;
    return ageS <= LIVE_HEARTBEAT_THRESHOLD_S;
  }).length;

  // Zombie workers — state != STOPPED AND state != NOT_STARTED AND heartbeat older than 5 min.
  const zombies = (workerRows || []).filter((r) => {
    const st = String(r.state || '').toUpperCase();
    if (st === 'STOPPED' || st === 'NOT_STARTED' || st === 'UNKNOWN') return false;
    const ageS = typeof r.heartbeat_age_s === 'number' ? r.heartbeat_age_s : Infinity;
    return ageS > LIVE_HEARTBEAT_THRESHOLD_S;
  });

  // Claimed handoffs — list claimed bucket, scan frontmatter for claimed_at.
  let claimedRecords = [];
  try {
    claimedRecords = listHandoffs({ baseDir, bucket: 'claimed', fsImpl }) || [];
  } catch {
    claimedRecords = [];
  }
  const claimedCount = claimedRecords.length;

  // Invariant 1: claims_exceed_capacity.
  const capacity = liveWorkers + (externalAgents || 0);
  if (claimedCount > capacity) {
    warnings.push({
      kind: 'claims_exceed_capacity',
      claimed: claimedCount,
      live_workers: liveWorkers,
      excess: claimedCount - capacity,
    });
  }

  // Invariant 2: oldest_stale_claim — any claim older than 6h.
  let oldest = null;
  for (const rec of claimedRecords) {
    const fm = rec && rec.frontmatter ? rec.frontmatter : {};
    const ts = fm.claimed_at;
    if (!ts) continue;
    const ageS = Math.floor((now - Date.parse(ts)) / 1000);
    if (!Number.isFinite(ageS)) continue;
    if (!oldest || ageS > oldest.age_seconds) {
      oldest = { ref: rec.id, claimed_by: fm.claimed_by || 'unknown', age_seconds: ageS };
    }
  }
  if (oldest && oldest.age_seconds > STALE_CLAIM_THRESHOLD_S) {
    warnings.push({
      kind: 'oldest_stale_claim',
      ref: oldest.ref,
      claimed_by: oldest.claimed_by,
      age_seconds: oldest.age_seconds,
      threshold_seconds: STALE_CLAIM_THRESHOLD_S,
    });
  }

  // Invariant 3: zombie_workers.
  if (zombies.length > 0) {
    warnings.push({
      kind: 'zombie_workers',
      count: zombies.length,
      ids: zombies.map((z) => z.id),
    });
  }

  return warnings;
}

/**
 * Render the WARNINGS section of `gad team status`.
 * Returns an array of lines (caller joins with newline).
 */
function formatWarnings(warnings) {
  const lines = [];
  if (!warnings || warnings.length === 0) {
    lines.push('WARNINGS: none');
    return lines;
  }
  lines.push('WARNINGS:');
  for (const w of warnings) {
    if (w.kind === 'claims_exceed_capacity') {
      lines.push(`  invariant_violation=claims_exceed_capacity claimed=${w.claimed} live_workers=${w.live_workers} excess=${w.excess}`);
    } else if (w.kind === 'oldest_stale_claim') {
      lines.push(`  oldest_stale_claim ref=${w.ref} claimed_by=${w.claimed_by} age=${formatDuration(w.age_seconds)} threshold=6h`);
    } else if (w.kind === 'zombie_workers') {
      lines.push(`  zombie_workers count=${w.count} ids=${(w.ids || []).join(',')}`);
    }
  }
  return lines;
}

/**
 * Write (or update) the <dispatcher> element in STATE.xml.
 * Inserts immediately after <level .../> if present, else after <state>.
 * No-ops silently if STATE.xml does not exist.
 */
function updateStateXmlDispatcher(stateXmlPath, hb) {
  if (!fs.existsSync(stateXmlPath)) return;
  let xml = fs.readFileSync(stateXmlPath, 'utf8');
  const tag = `  <dispatcher last_heartbeat="${hb.last_heartbeat || ''}" pid="${hb.pid || ''}" projectid="${hb.projectid || ''}" state="${hb.state}"/>`;
  // Replace existing <dispatcher .../> if present
  if (/<dispatcher\s/.test(xml)) {
    xml = xml.replace(/[ \t]*<dispatcher\s[^>]*\/?>\n?/, tag + '\n');
  } else if (/<level\s/.test(xml)) {
    // Insert after the <level .../> line
    xml = xml.replace(/([ \t]*<level\s[^>]*\/?>)/, `$1\n${tag}`);
  } else {
    // Insert right after <state...>
    xml = xml.replace(/(<state[^>]*>)/, `$1\n${tag}`);
  }
  fs.writeFileSync(stateXmlPath, xml);
}

function createStatusCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid } = deps;

  function resolveTeamTarget(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return { baseDir: repoRoot, stateXmlPath: null };
    const baseDir = path.join(repoRoot, root.path);
    const stateXmlPath = path.join(repoRoot, root.path, root.planningDir || '.planning', 'STATE.xml');
    return { baseDir, stateXmlPath };
  }

  /**
   * Attempt to restart the dispatcher via `gad team dispatcher start --projectid <p>`.
   * Uses spawnSync so we can capture the result inline.
   * Returns { success, output }.
   */
  function runDispatcherStart(projectid) {
    const gadBin = path.resolve(__dirname, '..', '..', 'gad.cjs');
    const argv = ['team', 'dispatcher', 'start'];
    if (projectid) argv.push('--projectid', projectid);
    const result = spawnSync(process.execPath, [gadBin, ...argv], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
    });
    const output = (result.stdout || '') + (result.stderr || '');
    return { success: result.status === 0, output: output.trim() };
  }

  /**
   * Write a state log entry for the restart via `gad state log`.
   * Best-effort — failures are silently ignored so status still renders.
   */
  function writeStateLog(projectid, reason) {
    try {
      const gadBin = path.resolve(__dirname, '..', '..', 'gad.cjs');
      const argv = ['state', 'log', `dispatcher auto-restarted (${reason})`];
      if (projectid) argv.push('--projectid', projectid);
      argv.push('--tags', 'dispatcher,auto-restart');
      spawnSync(process.execPath, [gadBin, ...argv], {
        encoding: 'utf8',
        timeout: 10_000,
        windowsHide: true,
      });
    } catch { /* best-effort */ }
  }

  return defineCommand({
    meta: { name: 'status', description: 'Show state of every worker (table or JSON).' },
    args: {
      projectid: { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' },
      json: { type: 'boolean', default: false },
      'auto-restart': { type: 'boolean', default: false, description: 'When dispatcher is DEAD, automatically restart it (also via GAD_TEAM_AUTO_RESTART=1).' },
    },
    run({ args }) {
      const { baseDir, stateXmlPath } = resolveTeamTarget(args);
      const cfg = readConfig(baseDir);
      if (!cfg) { console.log('No team configured. Run `gad team start --n <N>` first.'); return; }

      // Update STATE.xml with current dispatcher liveness before displaying.
      const hb = readHeartbeat(baseDir);
      if (stateXmlPath) {
        try { updateStateXmlDispatcher(stateXmlPath, hb); } catch {}
      }

      // --- Auto-restart logic (opt-in via flag or env var) ---
      const wantsAutoRestart = args['auto-restart'] || process.env.GAD_TEAM_AUTO_RESTART === '1';
      if (wantsAutoRestart && hb.state === 'DEAD') {
        const projectid = args.projectid || hb.projectid || '';
        const reason = hb.last_heartbeat ? 'stale-heartbeat' : 'no-heartbeat';
        const { blocked, count } = checkAndLogRestart(baseDir, projectid, reason);
        if (blocked) {
          console.log(`[auto-restart] Storm prevention: ${count} restart(s) already attempted in the last 5 min. Skipping.`);
        } else {
          // checkAndLogRestart pre-logged the attempt (success=false); just run it.
          console.log(`[auto-restart] Dispatcher is DEAD (${reason}). Restarting…`);
          const { success, output } = runDispatcherStart(projectid);
          if (success) {
            console.log(`[auto-restart] Restart succeeded. ${output}`);
            writeStateLog(projectid, reason);
          } else {
            console.log(`[auto-restart] Restart failed. Output: ${output}`);
          }
        }
      }

      const rows = listWorkerIds(baseDir).map(id => {
        const s = readStatus(baseDir, id) || {};
        const ageMs = s.last_heartbeat ? Date.now() - Date.parse(s.last_heartbeat) : null;
        const workerRuntime = s.runtime || cfg.runtime || null;
        const cooldownMs = workerRuntime ? getCooldownRemainingMs(baseDir, workerRuntime) : 0;
        const cooldown_remaining_seconds = cooldownMs > 0 ? Math.ceil(cooldownMs / 1000) : 0;
        return {
          id, role: s.role || '?', lane: s.lane || '-',
          state: s.state || 'UNKNOWN',
          mailbox: mailboxDepth(baseDir, id),
          current_ref: s.current_ref || '-',
          heartbeat_age_s: ageMs == null ? '-' : Math.round(ageMs / 1000),
          pid: s.pid || '-',
          runtime: workerRuntime || '-',
          cooldown_remaining_seconds,
        };
      });
      // Compute invariant-violation warnings (claimed handoffs vs live workers,
      // stale claims, zombie workers). Pure read of .planning/handoffs/claimed/.
      const warnings = computeWarnings({ baseDir, workerRows: rows });

      if (args.json) {
        console.log(JSON.stringify({ config: cfg, workers: rows, dispatcher: hb, warnings }, null, 2));
        return;
      }
      console.log(`Team: ${cfg.workers} workers${cfg.from_profile ? ` profile=${cfg.from_profile}` : ''}, runtime=${cfg.runtime}, autopause@${cfg.autopause_threshold}% remaining`);
      console.log(`Dispatcher: ${hb.state}  pid=${hb.pid == null ? 'n/a' : hb.pid}  heartbeat_age=${hb.age_s == null ? 'n/a' : hb.age_s + 's'}`);
      for (const line of formatWarnings(warnings)) console.log(line);
      console.log('');
      console.log('  ID   ROLE      LANE           RUNTIME       STATE         MAILBOX  COOLDOWN  CURRENT                           HB(s)  PID');
      console.log('  ──── ────────  ─────────────  ────────────  ────────────  ───────  ────────  ────────────────────────────────  ─────  ─────');
      for (const r of rows) {
        const ref = String(r.current_ref).slice(0, 32).padEnd(32);
        const lane = String(r.lane).slice(0, 13).padEnd(13);
        const rt = String(r.runtime).slice(0, 12).padEnd(12);
        const cd = r.cooldown_remaining_seconds > 0 ? `${r.cooldown_remaining_seconds}s` : '--';
        console.log(`  ${r.id.padEnd(4)} ${String(r.role).padEnd(8)} ${lane} ${rt} ${String(r.state).padEnd(12)} ${String(r.mailbox).padStart(7)}  ${cd.padStart(8)}  ${ref}  ${String(r.heartbeat_age_s).padStart(5)}  ${r.pid}`);
      }
    },
  });
}

module.exports = {
  createStatusCommand,
  computeWarnings,
  formatWarnings,
  LIVE_HEARTBEAT_THRESHOLD_S,
  STALE_CLAIM_THRESHOLD_S,
};
