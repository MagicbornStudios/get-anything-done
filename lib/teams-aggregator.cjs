'use strict';
/**
 * teams-aggregator — read-only snapshot of live team state.
 *
 * Reads from the parent repo's .planning/ tree (located via gad-config.toml /
 * pnpm-workspace.yaml walk). No writes, no AI, no new npm deps.
 *
 * Returns:
 *   { workers, dispatcher, accounts, cooldowns, presence, recentActivity }
 *
 * Phase 182, task 182-02.
 */

const fs   = require('fs');
const path = require('path');

// ─── Repo root discovery ──────────────────────────────────────────────────────

function findRepoRoot(start) {
  let dir = start || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'gad-config.toml'))) return dir;
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return start || process.cwd();
}

// ─── Safe readers ─────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readJsonLines(filePath, maxLines) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const tail = maxLines ? lines.slice(-maxLines) : lines;
    return tail.map((l) => {
      try { return JSON.parse(l); } catch { return { _raw: l }; }
    });
  } catch {
    return [];
  }
}

function readdirSafe(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

// ─── Workers ─────────────────────────────────────────────────────────────────

function gatherWorkers(planningDir) {
  const workersDir = path.join(planningDir, 'team', 'workers');
  const ids = readdirSafe(workersDir).filter((e) => {
    try { return fs.statSync(path.join(workersDir, e)).isDirectory(); } catch { return false; }
  });
  return ids.map((id) => {
    const statusPath = path.join(workersDir, id, 'status.json');
    const status = readJson(statusPath) || {};
    const stopFlagPath = path.join(workersDir, id, 'stop.flag');
    return {
      id,
      state: status.state || 'UNKNOWN',
      runtime: status.runtime || null,
      lane: status.lane || null,
      pid: status.pid || null,
      last_heartbeat: status.last_heartbeat || null,
      current_ref: status.current_ref || null,
      started_at: status.started_at || null,
      stopped_at: status.stopped_at || null,
      stop_flag_present: fs.existsSync(stopFlagPath),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

function gatherDispatcher(planningDir) {
  // State file (optional, may not exist)
  const statePath = path.join(planningDir, 'team', 'dispatcher', 'state.json');
  const state = readJson(statePath);

  // Heartbeat file
  const hbPath = path.join(planningDir, 'team', 'dispatcher.heartbeat.json');
  const heartbeat = readJson(hbPath);

  // PID file
  const pidPath = path.join(planningDir, 'team', 'dispatcher.pid');
  let pid = null;
  try {
    if (fs.existsSync(pidPath)) pid = fs.readFileSync(pidPath, 'utf8').trim();
  } catch {}

  // Last 10 log lines from dispatcher.log.jsonl
  const logPath = path.join(planningDir, 'team', 'dispatcher.log.jsonl');
  const recentLog = readJsonLines(logPath, 10);

  return {
    state,
    heartbeat,
    pid,
    recentLog,
    alive: heartbeat !== null,
  };
}

// ─── Accounts ────────────────────────────────────────────────────────────────

function gatherAccounts(planningDir) {
  const accountsPath = path.join(planningDir, 'team', 'runtime-accounts.json');
  const accountState = readJson(path.join(planningDir, 'team', 'runtime-account-state.json'));
  const accounts = readJson(accountsPath);
  return {
    accounts,
    state: accountState,
  };
}

// ─── Cooldowns (retired — just-try-it mode, no cooldown state written) ───────

function gatherCooldowns(_planningDir) {
  return []; // cooldown/parking was retired in phase 95-10 — always empty
}

// ─── Presence ────────────────────────────────────────────────────────────────

function gatherPresence(planningDir) {
  const presenceDir = path.join(planningDir, '.presence');
  const files = readdirSafe(presenceDir).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const data = readJson(path.join(presenceDir, f)) || {};
    return {
      file: f,
      agent_slug: data.agent_slug || null,
      projectid: data.projectid || null,
      runtime: data.runtime || null,
      model: data.model || null,
      started_at: data.started_at || null,
      last_heartbeat: data.last_heartbeat || null,
      current_focus_route: data.current_focus_route || null,
      active_skill: data.active_skill || null,
      current_handoff_id: data.current_handoff_id || null,
    };
  });
}

// ─── Recent Activity (last 50 log entries across today + yesterday) ───────────

function gatherRecentActivity(planningDir) {
  const logDir = path.join(planningDir, '.gad-log');
  const files = readdirSafe(logDir)
    .filter((f) => f.endsWith('.jsonl') && !f.startsWith('token-budgets'))
    .sort()
    .reverse(); // most recent first

  const entries = [];
  for (const f of files) {
    if (entries.length >= 50) break;
    const lines = readJsonLines(path.join(logDir, f), 200);
    // Take from end of file (most recent)
    for (let i = lines.length - 1; i >= 0 && entries.length < 50; i--) {
      entries.push(lines[i]);
    }
  }

  return entries.slice(0, 50).map((e) => ({
    ts: e.ts || null,
    type: e.type || null,
    tool: e.tool || null,
    session_id: e.session_id || null,
    input_summary: e.input_summary || null,
  }));
}

// ─── Main aggregator ─────────────────────────────────────────────────────────

function aggregate(repoRoot) {
  const root = repoRoot || findRepoRoot();
  const planningDir = path.join(root, '.planning');

  return {
    snapshot_at: new Date().toISOString(),
    repo_root: root,
    workers: gatherWorkers(planningDir),
    dispatcher: gatherDispatcher(planningDir),
    accounts: gatherAccounts(planningDir),
    cooldowns: gatherCooldowns(planningDir),
    presence: gatherPresence(planningDir),
    recentActivity: gatherRecentActivity(planningDir),
  };
}

module.exports = { aggregate, findRepoRoot };
