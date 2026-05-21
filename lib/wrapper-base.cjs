'use strict';
/**
 * wrapper-base.cjs — shared spawn + structured log helper for gad binary wrappers.
 *
 * Used by: bin/commands/wrappers/git.cjs, bin/commands/wrappers/gh.cjs
 * Future:  hf, modal, docker wrappers (GLOBAL-D-316)
 *
 * Envelope shape (matches existing gad-log telemetry so entries land in
 * `gad telemetry summary` automatically via the gad-log source adapter):
 *   { ts, command, args, exit_code, duration_ms, runtime, cwd }
 *
 * Behaviour:
 *   - spawnSync with stdio: 'inherit' — operator sees no difference vs raw binary.
 *   - Detects missing binary → exits 127 with clear message.
 *   - Appends one JSONL line to .planning/.gad-log/<YYYY-MM-DD>.jsonl.
 *   - Log write failure is silent (never block the wrapped binary).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Walk upward from `start` looking for a `.planning/` directory.
 * Returns the directory that contains `.planning/`, or null if not found.
 */
function findRepoRoot(start) {
  let dir = start || process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Resolve the log directory for today's JSONL log file.
 * Respects GAD_LOG_DIR env var (same as side-effects.cjs).
 * Returns null if no .planning root found.
 */
function resolveLogDir() {
  if (process.env.GAD_LOG_DIR) return process.env.GAD_LOG_DIR;
  const root = findRepoRoot(process.cwd());
  if (!root) return null;
  return path.join(root, '.planning', '.gad-log');
}

/**
 * Append one JSONL envelope to today's log file.
 * Failures are silently swallowed — never block the wrapped binary.
 */
function appendLog(envelope) {
  try {
    const dir = resolveLogDir();
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, `${date}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(envelope) + '\n');
  } catch { /* silent */ }
}

/**
 * Run a binary passthrough with stdio inherited and structured log output.
 *
 * @param {object} opts
 * @param {string}   opts.command   - Binary name, e.g. 'git' or 'gh'
 * @param {string[]} opts.args      - Args to forward verbatim
 * @returns {never} Always calls process.exit()
 */
function runWrapper({ command, args }) {
  // Detect missing binary early — spawnSync returns status=null + error.ENOENT
  const probe = spawnSync(command, ['--version'], { stdio: 'pipe', windowsHide: true });
  if (probe.error && probe.error.code === 'ENOENT') {
    process.stderr.write(
      `gad ${command}: binary '${command}' not found on PATH (exit 127)\n`,
    );
    process.exit(127);
  }

  const start = Date.now();
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  const duration_ms = Date.now() - start;
  const exit_code = result.status != null ? result.status : 1;

  // Build envelope — shape matches gad-log so telemetry summary picks it up
  const envelope = {
    ts: new Date().toISOString(),
    command,
    args,
    exit_code,
    duration_ms,
    runtime: 'gad-wrapper',
    cwd: process.cwd(),
  };

  appendLog(envelope);
  process.exit(exit_code);
}

module.exports = { runWrapper, findRepoRoot, resolveLogDir, appendLog };
