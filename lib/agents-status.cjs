'use strict';

/**
 * agents-status.cjs — read-only inspection of active runtimes + subagent runs.
 *
 * Answers "who is actually alive right now?" without spawning agents or
 * writing state. Used by `gad agents status`.
 *
 * Signal sources (read-only, never-fail-hard):
 *   1. Binary probes — which runtime CLIs exist on PATH
 *   2. OMX state — .omx/state/*.json for Codex-via-OMX activity
 *   3. Handoff queue — per-runtime pending counts
 *   4. Daily subagent runs — today's + recent prompts / reports
 *   5. Router lock — gad-tui auto-router daemon presence
 *
 * No network. No spawning. Probes use `where`/`which` only (not --version).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KNOWN_RUNTIMES = [
  { id: 'claude-code', bin: 'claude', envFingerprints: ['CLAUDECODE', 'CLAUDE_CONFIG_DIR', 'CLAUDE_CODE_ENTRYPOINT'] },
  { id: 'codex', bin: 'codex', envFingerprints: ['CODEX_SESSION_ID', 'CODEX_HOME', 'CODEX_CLI'] },
  { id: 'cursor', bin: 'cursor-agent', envFingerprints: ['CURSOR_AGENT_ID', 'CURSOR_SESSION', 'CURSOR_TRACE_ID'] },
  { id: 'gemini', bin: 'gemini', envFingerprints: ['GEMINI_SESSION_ID'] },
  { id: 'opencode', bin: 'opencode', envFingerprints: ['OPENCODE_SESSION_ID'] },
];

function probeBinary(bin) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const out = execSync(`${cmd} ${bin}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
    return String(out).trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isoNowMinus(ms) {
  return new Date(Date.now() - ms).toISOString();
}

function ageMs(isoTs) {
  if (!isoTs) return null;
  const t = Date.parse(String(isoTs));
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

function formatAge(ms) {
  if (ms == null) return '-';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/**
 * Probe all known runtimes: installed + env-fingerprint for current process.
 * Returns array of { id, installed, binPath, currentProcess, envHints }.
 */
function probeRuntimes({ skipProbe = false, env = process.env } = {}) {
  return KNOWN_RUNTIMES.map((rt) => {
    const binPath = skipProbe ? null : probeBinary(rt.bin);
    const envHints = rt.envFingerprints.filter((name) => env[name]);
    return {
      id: rt.id,
      bin: rt.bin,
      installed: skipProbe ? null : !!binPath,
      binPath,
      currentProcess: envHints.length > 0,
      envHints,
    };
  });
}

/**
 * Inspect OMX state files for the codex-via-OMX workflow layer.
 * Returns { active, mode, lastTurnAt, iteration, ageMs } or null if no OMX.
 */
function readOmxState(baseDir) {
  // Decision gad-282 (2026-04-22): state consolidates under .planning/team/.
  // Prefer new path; fall back to legacy .omx/state/ for backward compat
  // during transition (OMX vendored code still writes .omx/ until its
  // paths.ts is shimmed in a separate task).
  const newPath = path.join(baseDir, '.planning', 'team', 'state.json');
  const legacyPath = path.join(baseDir, '.omx', 'state', 'team-state.json');
  const data = readJsonSafe(newPath) || readJsonSafe(legacyPath);
  if (!data) return null;
  const lastTurnAt = data.last_turn_at || data.updated_at || null;
  return {
    active: !!data.active,
    mode: data.mode || null,
    lastTurnAt,
    iteration: data.iteration || null,
    ageMs: ageMs(lastTurnAt),
    threadId: data.thread_id || null,
  };
}

/**
 * Check for the gad-tui router daemon lockfile.
 * Returns { running, lockPath, pid, ageMs } or null.
 */
function readRouterLock(baseDir) {
  const lockPath = path.join(baseDir, 'packages', 'gad-tui', '.gad', 'router-logs', '.lock');
  if (!fs.existsSync(lockPath)) return null;
  let pid = null;
  let mtimeAt = null;
  try {
    pid = fs.readFileSync(lockPath, 'utf8').trim();
  } catch { /* noop */ }
  try {
    mtimeAt = fs.statSync(lockPath).mtime.toISOString();
  } catch { /* noop */ }
  return {
    running: true,
    lockPath,
    pid: pid || null,
    mtimeAt,
    ageMs: ageMs(mtimeAt),
  };
}

/**
 * List today's subagent-run artifacts per project.
 * Returns array of { projectid, taskId, date, status, promptPath, jsonPath }.
 */
function listSubagentRuns(baseDir, { daysBack = 1 } = {}) {
  const results = [];
  const runsRoot = path.join(baseDir, 'projects');
  if (!fs.existsSync(runsRoot)) {
    // Try another common root
    return results;
  }
  const today = new Date();
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  const scanProjectDir = (projectid, projectRoot) => {
    const subagentDir = path.join(projectRoot, '.planning', 'subagent-runs', projectid);
    if (!fs.existsSync(subagentDir)) return;
    let files;
    try {
      files = fs.readdirSync(subagentDir);
    } catch {
      return;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const full = path.join(subagentDir, file);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.mtimeMs < cutoff) continue;
      const data = readJsonSafe(full);
      if (!data) continue;
      results.push({
        projectid: data.projectId || projectid,
        taskId: data.taskId || null,
        date: file.slice(0, 10),
        status: data.status || 'unknown',
        promptPath: data.promptPath || null,
        jsonPath: path.relative(baseDir, full),
        endedAt: data.endedAt || null,
        startedAt: data.startedAt || null,
      });
    }
  };

  // Walk every project in projects/ that has .planning/subagent-runs/<projectid>/
  let projectEntries;
  try {
    projectEntries = fs.readdirSync(runsRoot, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of projectEntries) {
    if (!entry.isDirectory()) continue;
    scanProjectDir(entry.name, path.join(runsRoot, entry.name));
  }
  // Also check root-level .planning/subagent-runs/ if present
  const rootSubagent = path.join(baseDir, '.planning', 'subagent-runs');
  if (fs.existsSync(rootSubagent)) {
    try {
      const rootChildren = fs.readdirSync(rootSubagent);
      for (const child of rootChildren) {
        scanProjectDir(child, baseDir);
      }
    } catch { /* noop */ }
  }

  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return results;
}

/**
 * Infer per-(runtime, session) liveness from GAD CLI + hook logs.
 *
 * Rationale (operator decision 2026-04-19): explicit heartbeats are
 * useless overhead when every agent already spams the GAD CLI. Reads
 * two sources:
 *   1. `.planning/.gad-log/<today>.jsonl`  — every `gad` CLI invocation,
 *      universal signal (works for any runtime that sets fingerprint env
 *      vars — see lib/runtime-detect.cjs)
 *   2. `.planning/.trace-events.jsonl`      — Claude Code hook events
 *      (only populated when `gad install hooks` is wired for Claude Code)
 *
 * Union of both. Each entry is tagged with `source` so callers can see
 * whether liveness came from a CLI call or a hook event.
 *
 * Groups by (runtime.id, runtime.session_id), keeps latest ts per group.
 * Returns array sorted most-recent first:
 *   [{ runtime, sessionId, lastSeenAt, ageMs, stale, lastTool,
 *      eventCount, sources }]
 *
 * Stale threshold default 10 min — adjust via opts.staleMs.
 */
function inferLivenessFromLogs(baseDir, { staleMs = 10 * 60 * 1000, gadLogPath, tracePath } = {}) {
  const byKey = new Map();

  // Source 1 — gad-log (universal, any runtime that calls `gad`)
  const todayIso = new Date().toISOString().slice(0, 10);
  const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const gadLogDir = path.join(baseDir, '.planning', '.gad-log');
  const gadLogFiles = gadLogPath ? [gadLogPath]
    : [path.join(gadLogDir, `${todayIso}.jsonl`), path.join(gadLogDir, `${yesterdayIso}.jsonl`)];
  for (const filePath of gadLogFiles) {
    if (!fs.existsSync(filePath)) continue;
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { continue; }
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.length < 10) continue;
      let evt;
      try { evt = JSON.parse(line); } catch { continue; }
      if (!evt || !evt.ts) continue;
      const runtime = (evt.runtime && evt.runtime.id) || 'unknown';
      const sessionId = (evt.runtime && evt.runtime.session_id) || null;
      const key = `${runtime}|${sessionId || ''}`;
      const existing = byKey.get(key);
      if (!existing || evt.ts > existing.lastSeenAt) {
        byKey.set(key, {
          runtime,
          sessionId,
          lastSeenAt: evt.ts,
          lastTool: `gad ${evt.cmd || ''}`.trim(),
          eventCount: (existing ? existing.eventCount : 0) + 1,
          sources: new Set([...(existing ? existing.sources : []), 'gad-log']),
        });
      } else {
        existing.eventCount += 1;
        existing.sources.add('gad-log');
      }
    }
  }

  // Source 2 — Claude Code hook trace-events
  const tracePathResolved = tracePath || path.join(baseDir, '.planning', '.trace-events.jsonl');
  if (fs.existsSync(tracePathResolved)) {
    let content;
    try { content = fs.readFileSync(tracePathResolved, 'utf8'); } catch { content = null; }
    if (content) {
      for (const line of content.split(/\r?\n/)) {
        if (!line || line.length < 10) continue;
        let evt;
        try { evt = JSON.parse(line); } catch { continue; }
        if (!evt || !evt.ts || !evt.runtime) continue;
        const runtime = evt.runtime.id || 'unknown';
        const sessionId = evt.runtime.session_id || null;
        const key = `${runtime}|${sessionId || ''}`;
        const existing = byKey.get(key);
        if (!existing || evt.ts > existing.lastSeenAt) {
          byKey.set(key, {
            runtime,
            sessionId,
            lastSeenAt: evt.ts,
            lastTool: evt.tool || evt.type || null,
            eventCount: (existing ? existing.eventCount : 0) + 1,
            sources: new Set([...(existing ? existing.sources : []), 'trace-events']),
          });
        } else {
          existing.eventCount += 1;
          existing.sources.add('trace-events');
        }
      }
    }
  }

  const out = [...byKey.values()].map((r) => {
    const age = ageMs(r.lastSeenAt);
    return {
      runtime: r.runtime,
      sessionId: r.sessionId,
      lastSeenAt: r.lastSeenAt,
      ageMs: age,
      stale: age == null ? true : age > staleMs,
      lastTool: r.lastTool,
      eventCount: r.eventCount,
      sources: [...r.sources],
    };
  });
  out.sort((a, b) => (a.ageMs || Infinity) - (b.ageMs || Infinity));
  return out;
}

// Back-compat shim so older callers don't break
const inferLivenessFromTrace = inferLivenessFromLogs;

module.exports = {
  KNOWN_RUNTIMES,
  probeRuntimes,
  probeBinary,
  readOmxState,
  readRouterLock,
  listSubagentRuns,
  inferLivenessFromLogs,
  inferLivenessFromTrace,
  formatAge,
  ageMs,
};
