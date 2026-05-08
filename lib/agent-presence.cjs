'use strict';
/**
 * lib/agent-presence.cjs — read/write/list helpers for the agent presence ledger.
 *
 * Each Claude (or other runtime) instance writes a JSON file under
 * .planning/.presence/<agent-slug>.json on session open and on heartbeat.
 *
 * File shape:
 * {
 *   agent_slug:          string,
 *   projectid:           string,
 *   runtime:             string,
 *   model:               string | null,
 *   started_at:          ISO-8601,
 *   last_heartbeat:      ISO-8601,
 *   current_focus_route: string | null,
 *   current_focus_cid:   string | null,
 *   active_skill:        string | null,
 *   current_handoff_id:  string | null,
 * }
 *
 * GLOBAL-D-323 Phase B.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PRESENCE_DIR     = '.presence';
const LIVE_THRESHOLD_S = 300; // 5 min → live; else idle

// ---------------------------------------------------------------------------
// Agent-slug resolution  (priority per spec)
// ---------------------------------------------------------------------------

function resolveAgentSlug(projectid) {
  if (process.env.GAD_AGENT_NAME) {
    return process.env.GAD_AGENT_NAME;
  }
  const user = process.env.USERNAME || process.env.USER || os.userInfo().username || 'agent';
  if (projectid) {
    return `${user}-${projectid}`;
  }
  return `anonymous-${projectid || 'unknown'}`;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function presenceDir(baseDir) {
  return path.join(baseDir, '.planning', PRESENCE_DIR);
}

function presenceFilePath(baseDir, agentSlug) {
  return path.join(presenceDir(baseDir), `${agentSlug}.json`);
}

// ---------------------------------------------------------------------------
// Write (one-shot heartbeat write)
// ---------------------------------------------------------------------------

/**
 * Write (or refresh) presence for this process.
 *
 * @param {object} opts
 * @param {string}  opts.baseDir
 * @param {string}  opts.projectid
 * @param {string} [opts.runtime]          - detected runtime id
 * @param {string} [opts.model]            - detected model string
 * @param {string} [opts.focusRoute]       - optional focus route
 * @param {string} [opts.focusCid]         - optional focus cid
 * @param {string} [opts.activeSkill]      - optional skill slug
 * @param {string} [opts.currentHandoffId] - optional handoff id
 * @returns {{ agentSlug: string, filePath: string }}
 */
function write({ baseDir, projectid, runtime, model, focusRoute, focusCid, activeSkill, currentHandoffId }) {
  const agentSlug = resolveAgentSlug(projectid);
  const filePath  = presenceFilePath(baseDir, agentSlug);
  const dir       = presenceDir(baseDir);

  // Read existing to preserve started_at
  let existing = null;
  try {
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    // corrupt or missing — start fresh
  }

  const now = new Date().toISOString();
  const record = {
    agent_slug:           agentSlug,
    projectid:            projectid || null,
    // Preserve existing runtime/model when not explicitly provided (e.g. during claim)
    runtime:              runtime    !== undefined ? (runtime    || process.env.GAD_RUNTIME || 'unknown')
                                                  : (existing ? existing.runtime : (process.env.GAD_RUNTIME || 'unknown')),
    model:                model      !== undefined ? (model      || process.env.GAD_MODEL || process.env.CLAUDE_MODEL || null)
                                                  : (existing ? existing.model   : (process.env.GAD_MODEL || process.env.CLAUDE_MODEL || null)),
    started_at:           existing   ? existing.started_at : now,
    last_heartbeat:       now,
    current_focus_route:  focusRoute  !== undefined ? (focusRoute  || null) : (existing ? existing.current_focus_route  : null),
    current_focus_cid:    focusCid    !== undefined ? (focusCid    || null) : (existing ? existing.current_focus_cid    : null),
    active_skill:         activeSkill !== undefined ? (activeSkill || null) : (existing ? existing.active_skill         : null),
    current_handoff_id:   currentHandoffId !== undefined ? (currentHandoffId || null) : (existing ? existing.current_handoff_id : null),
  };

  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  } catch (err) {
    // best-effort; never crash the caller
    process.stderr.write(`[agent-presence] write failed: ${err.message}\n`);
  }

  return { agentSlug, filePath };
}

// ---------------------------------------------------------------------------
// Claim — update specific fields without full overwrite
// ---------------------------------------------------------------------------

/**
 * Update focus/skill/handoff fields in-place.
 */
function claim({ baseDir, projectid, focusRoute, focusCid, activeSkill, currentHandoffId }) {
  return write({ baseDir, projectid, focusRoute, focusCid, activeSkill, currentHandoffId });
}

// ---------------------------------------------------------------------------
// Read a single presence file
// ---------------------------------------------------------------------------

function readPresenceFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cross-root scan
// ---------------------------------------------------------------------------

/**
 * Collect all presence files from every planning root under baseDir.
 * Also scans sibling directories listed in gad-config.toml roots (if resolvable).
 *
 * @param {string} baseDir  - repo root
 * @param {object} [config] - optional parsed gad-config (for multi-root scan)
 * @returns {Array<{filePath: string, record: object, ageSeconds: number, live: boolean}>}
 */
function scan(baseDir, config) {
  const dirs = new Set();

  // Always include the main planning root
  dirs.add(presenceDir(baseDir));

  // Include additional roots declared in gad-config
  if (config && Array.isArray(config.roots)) {
    for (const root of config.roots) {
      if (root && root.path) {
        const rootAbs = path.isAbsolute(root.path)
          ? root.path
          : path.join(baseDir, root.path);
        dirs.add(path.join(rootAbs, '.planning', PRESENCE_DIR));
      }
    }
  }

  const now = Date.now();
  const results = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    let files;
    try { files = fs.readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const filePath = path.join(dir, f);
      const record   = readPresenceFile(filePath);
      if (!record) continue;
      const hb       = record.last_heartbeat ? new Date(record.last_heartbeat).getTime() : 0;
      const ageS     = Math.round((now - hb) / 1000);
      results.push({ filePath, record, ageSeconds: ageS, live: ageS <= LIVE_THRESHOLD_S });
    }
  }

  // Sort: live first, then by ageSeconds ascending
  results.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    return a.ageSeconds - b.ageSeconds;
  });

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ageLabel(seconds) {
  if (seconds < 60)   return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

module.exports = {
  LIVE_THRESHOLD_S,
  resolveAgentSlug,
  presenceDir,
  presenceFilePath,
  write,
  claim,
  scan,
  ageLabel,
};
