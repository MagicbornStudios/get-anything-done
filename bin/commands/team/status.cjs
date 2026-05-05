'use strict';
/**
 * gad team status — table or JSON view of every worker.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { readConfig } = require('../../../lib/team/config.cjs');
const { listWorkerIds, readStatus } = require('../../../lib/team/status.cjs');
const { mailboxDepth } = require('../../../lib/team/mailbox.cjs');
const { readHeartbeat } = require('../../../lib/team/dispatcher.cjs');

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

  return defineCommand({
    meta: { name: 'status', description: 'Show state of every worker (table or JSON).' },
    args: {
      projectid: { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' },
      json: { type: 'boolean', default: false },
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

      const rows = listWorkerIds(baseDir).map(id => {
        const s = readStatus(baseDir, id) || {};
        const ageMs = s.last_heartbeat ? Date.now() - Date.parse(s.last_heartbeat) : null;
        return {
          id, role: s.role || '?', lane: s.lane || '-',
          state: s.state || 'UNKNOWN',
          mailbox: mailboxDepth(baseDir, id),
          current_ref: s.current_ref || '-',
          heartbeat_age_s: ageMs == null ? '-' : Math.round(ageMs / 1000),
          pid: s.pid || '-',
          runtime: s.runtime || cfg.runtime || '-',
        };
      });
      if (args.json) { console.log(JSON.stringify({ config: cfg, workers: rows, dispatcher: hb }, null, 2)); return; }
      console.log(`Team: ${cfg.workers} workers${cfg.from_profile ? ` profile=${cfg.from_profile}` : ''}, runtime=${cfg.runtime}, autopause@${cfg.autopause_threshold}% remaining`);
      console.log(`Dispatcher: ${hb.state}  pid=${hb.pid == null ? 'n/a' : hb.pid}  heartbeat_age=${hb.age_s == null ? 'n/a' : hb.age_s + 's'}`);
      console.log('');
      console.log('  ID   ROLE      LANE           RUNTIME       STATE         MAILBOX  CURRENT                           HB(s)  PID');
      console.log('  ──── ────────  ─────────────  ────────────  ────────────  ───────  ────────────────────────────────  ─────  ─────');
      for (const r of rows) {
        const ref = String(r.current_ref).slice(0, 32).padEnd(32);
        const lane = String(r.lane).slice(0, 13).padEnd(13);
        const rt = String(r.runtime).slice(0, 12).padEnd(12);
        console.log(`  ${r.id.padEnd(4)} ${String(r.role).padEnd(8)} ${lane} ${rt} ${String(r.state).padEnd(12)} ${String(r.mailbox).padStart(7)}  ${ref}  ${String(r.heartbeat_age_s).padStart(5)}  ${r.pid}`);
      }
    },
  });
}

module.exports = { createStatusCommand };
