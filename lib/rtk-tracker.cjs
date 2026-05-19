'use strict';

/**
 * rtk-tracker.cjs — capture rtk gain telemetry into the gad audit trail.
 *
 * Phase 260 (task GLOBAL-T-260-05). rtk (Rust Token Killer) maintains its
 * own internal stats database (~/.local/share/rtk/stats.db or similar).
 * `rtk gain -f json` exposes a rollup of that state. This tracker captures
 * periodic snapshots of that rollup, appends them to
 * `.planning/.gad-log/rtk-gains.jsonl`, and exposes the snapshot stream so
 * downstream consumers (build-metrics rollup, desk panels, anomaly
 * detector) can read trend data without re-invoking rtk.
 *
 * Snapshot record shape (one JSON object per line):
 *   {
 *     ts: ISO-8601 UTC,
 *     binary: resolved path to rtk binary,
 *     version: rtk --version output,
 *     total_commands: int,
 *     total_input: int (tokens),
 *     total_output: int (tokens),
 *     total_saved: int (tokens),
 *     avg_savings_pct: float (0..100),
 *     total_time_ms: int,
 *     avg_time_ms: int,
 *     delta_commands: int | null (since last snapshot, null on first),
 *     delta_saved: int | null,
 *     project: string | null (cwd basename or projectid hint),
 *   }
 *
 * Contract: read-only against rtk state. Append-only JSONL writes; never
 * truncates existing log. Safe to call concurrently — line-buffered
 * appends are atomic on POSIX + Win32 for ≤ 4KB writes.
 *
 * Resolution order for the rtk binary:
 *   1. opts.binary (caller override)
 *   2. workflow.rtk.binary_path setting (gad settings-registry)
 *   3. $GAD_RTK_BINARY_PATH env
 *   4. PATH lookup via spawnSync('rtk', ['--version'])
 *
 * Disabled when workflow.rtk.enabled is false (the default). Caller is
 * responsible for checking via getSetting() before invoking capture().
 *
 * No dependencies beyond node:* + the existing settings-registry helper.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// Lazy require to avoid circular dep if settings-registry ever needs us.
let settingsRegistry = null;
function getSettingsRegistry() {
  if (!settingsRegistry) {
    try {
      settingsRegistry = require('./settings-registry.cjs');
    } catch (_) {
      settingsRegistry = { getSetting: () => null };
    }
  }
  return settingsRegistry;
}

function defaultLogPath(projectRoot) {
  return path.join(projectRoot, '.planning', '.gad-log', 'rtk-gains.jsonl');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Resolve the rtk binary path. Returns absolute path if found, null otherwise.
 */
function resolveRtkBinary(opts = {}) {
  // 1. Explicit override
  if (opts.binary && fs.existsSync(opts.binary)) return opts.binary;

  // 2. Settings registry
  const reg = getSettingsRegistry();
  let configured = null;
  try {
    if (typeof reg.getSetting === 'function') {
      configured = reg.getSetting('workflow.rtk.binary_path', null, { projectRoot: opts.projectRoot });
    }
  } catch (_) {
    // settings lookup is best-effort
  }
  if (configured && typeof configured === 'string' && fs.existsSync(configured)) return configured;

  // 3. Env
  if (process.env.GAD_RTK_BINARY_PATH && fs.existsSync(process.env.GAD_RTK_BINARY_PATH)) {
    return process.env.GAD_RTK_BINARY_PATH;
  }

  // 4. PATH lookup — try the platform's locator first.
  //    Windows: prefer `where.exe` (works regardless of shell — bash + cmd).
  //    Unix:    `which`.
  const locators = process.platform === 'win32' ? ['where.exe', 'where'] : ['which'];
  for (const locator of locators) {
    const result = spawnSync(locator, ['rtk'], { encoding: 'utf8', shell: false });
    if (result.status === 0 && result.stdout) {
      const first = result.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    }
  }

  // 5. Last-resort: check well-known install paths.
  const home = os.homedir();
  const candidates = process.platform === 'win32'
    ? [
        path.join(home, '.local', 'bin', 'rtk.exe'),
        path.join(home, 'bin', 'rtk.exe'),
        path.join(home, '.cargo', 'bin', 'rtk.exe'),
      ]
    : [
        path.join(home, '.local', 'bin', 'rtk'),
        path.join(home, 'bin', 'rtk'),
        path.join(home, '.cargo', 'bin', 'rtk'),
        '/usr/local/bin/rtk',
      ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return null;
}

/**
 * Invoke `<rtk> --version` and return the version string, or null on failure.
 */
function rtkVersion(binary) {
  const res = spawnSync(binary, ['--version'], { encoding: 'utf8', shell: false });
  if (res.status !== 0 || !res.stdout) return null;
  return res.stdout.trim();
}

/**
 * Invoke `<rtk> gain -f json` and return the parsed JSON, or null on failure.
 * Optionally scope to current project with --project.
 */
function rtkGainJson(binary, { projectScope = false } = {}) {
  const finalArgs = projectScope ? ['gain', '-p', '-f', 'json'] : ['gain', '-f', 'json'];
  const res = spawnSync(binary, finalArgs, { encoding: 'utf8', shell: false });
  if (res.status !== 0 || !res.stdout) return null;
  try {
    return JSON.parse(res.stdout);
  } catch (_) {
    return null;
  }
}

/**
 * Read the last JSONL record from rtk-gains log, or null if empty/missing.
 * Used to compute deltas vs previous snapshot.
 */
function readLastSnapshot(logPath) {
  if (!fs.existsSync(logPath)) return null;
  let stat;
  try {
    stat = fs.statSync(logPath);
  } catch (_) {
    return null;
  }
  if (stat.size === 0) return null;
  // Read final ~8KB chunk and pull the last full line.
  const fd = fs.openSync(logPath, 'r');
  try {
    const chunkSize = Math.min(8192, stat.size);
    const buf = Buffer.alloc(chunkSize);
    fs.readSync(fd, buf, 0, chunkSize, stat.size - chunkSize);
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    try {
      return JSON.parse(lines[lines.length - 1]);
    } catch (_) {
      return null;
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Capture one snapshot and append to the gad-log.
 *
 * @param {object} opts
 * @param {string} opts.projectRoot — repo root (required for log path)
 * @param {string} [opts.binary] — override rtk binary path
 * @param {string} [opts.logPath] — override log file path
 * @param {boolean} [opts.projectScope] — use rtk gain -p instead of global
 * @param {string} [opts.project] — project hint to record alongside snapshot
 *
 * @returns {{ ok: boolean, reason?: string, record?: object, path?: string }}
 */
function capture(opts = {}) {
  if (!opts.projectRoot) {
    return { ok: false, reason: 'projectRoot required' };
  }

  const binary = resolveRtkBinary(opts);
  if (!binary) {
    return { ok: false, reason: 'rtk binary not found (set workflow.rtk.binary_path or install rtk in PATH)' };
  }

  const version = rtkVersion(binary);
  const data = rtkGainJson(binary, { projectScope: !!opts.projectScope });
  if (!data || !data.summary) {
    return { ok: false, reason: `rtk gain -f json failed or returned malformed output (binary=${binary})` };
  }

  const logPath = opts.logPath || defaultLogPath(opts.projectRoot);
  ensureDir(path.dirname(logPath));

  const prev = readLastSnapshot(logPath);
  const s = data.summary;
  const record = {
    ts: new Date().toISOString(),
    binary,
    version,
    total_commands: Number(s.total_commands || 0),
    total_input: Number(s.total_input || 0),
    total_output: Number(s.total_output || 0),
    total_saved: Number(s.total_saved || 0),
    avg_savings_pct: Number(s.avg_savings_pct || 0),
    total_time_ms: Number(s.total_time_ms || 0),
    avg_time_ms: Number(s.avg_time_ms || 0),
    delta_commands: prev ? Number(s.total_commands || 0) - Number(prev.total_commands || 0) : null,
    delta_saved: prev ? Number(s.total_saved || 0) - Number(prev.total_saved || 0) : null,
    project: opts.project || null,
    scope: opts.projectScope ? 'project' : 'global',
  };

  fs.appendFileSync(logPath, JSON.stringify(record) + '\n', { encoding: 'utf8' });

  return { ok: true, record, path: logPath };
}

/**
 * Read all snapshots from the log, oldest-first. Returns [] if log missing.
 */
function readAll(opts = {}) {
  if (!opts.projectRoot && !opts.logPath) return [];
  const logPath = opts.logPath || defaultLogPath(opts.projectRoot);
  if (!fs.existsSync(logPath)) return [];
  const text = fs.readFileSync(logPath, 'utf8');
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch (_) {
      // skip corrupt
    }
  }
  return out;
}

/**
 * Read snapshots within an ISO week. Used by the build-metrics rollup
 * to populate the rtk savings column.
 *
 * @returns { firstSnapshot, lastSnapshot, delta_commands, delta_saved, savings_pct } | null
 */
function weeklyDelta(opts = {}) {
  const { weekStartIso, weekEndIso } = opts;
  const all = readAll(opts);
  if (all.length === 0) return null;
  const within = all.filter((r) => {
    if (!r.ts) return false;
    if (weekStartIso && r.ts < weekStartIso) return false;
    if (weekEndIso && r.ts >= weekEndIso) return false;
    return true;
  });
  if (within.length === 0) return null;
  const first = within[0];
  const last = within[within.length - 1];
  const delta_commands = Number(last.total_commands || 0) - Number(first.total_commands || 0);
  const delta_saved = Number(last.total_saved || 0) - Number(first.total_saved || 0);
  const total_input_delta = Number(last.total_input || 0) - Number(first.total_input || 0);
  const savings_pct = total_input_delta > 0 ? (delta_saved / total_input_delta) * 100 : 0;
  return {
    first_ts: first.ts,
    last_ts: last.ts,
    snapshots: within.length,
    delta_commands,
    delta_saved,
    savings_pct,
  };
}

module.exports = {
  defaultLogPath,
  resolveRtkBinary,
  rtkVersion,
  rtkGainJson,
  readLastSnapshot,
  capture,
  readAll,
  weeklyDelta,
};
