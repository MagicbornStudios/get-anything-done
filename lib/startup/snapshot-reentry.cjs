'use strict';
/**
 * startup/snapshot-reentry.cjs — spawn `gad snapshot` as a child process.
 *
 * Re-entry contract:
 *   packaged runtime  → invoke the packaged gad executable (or the value
 *                       of env GAD_STARTUP_PRIMARY_EXECUTABLE when the
 *                       caller pinned a specific binary)
 *   unpackaged        → invoke `node vendor/.../bin/gad.cjs`
 *
 * Hardening: the packaged detector (lib/install-helpers.cjs) now also
 * inspects basename(process.execPath). That removes the prior failure
 * mode where a stale/shim-less install spawned the packaged gad with
 * `gad.cjs` as the first positional arg and crashed with
 * `Unknown command gad.cjs`.
 *
 * Returns the numeric exit code (0 on success).
 */

const path = require('path');

const STARTUP_PRIMARY_EXECUTABLE_ENV = 'GAD_STARTUP_PRIMARY_EXECUTABLE';

function resolveEntryFilename() {
  if (require.main && require.main.filename) return require.main.filename;
  return path.resolve(__dirname, '..', '..', 'bin', 'gad.cjs');
}

function spawnSnapshot({
  projectId,
  sessionArg = [],
  extraArgs = [],
  isPackagedExecutableRuntime,
  getPackagedExecutablePath,
  sideEffectsSuppressed,
  NO_SIDE_EFFECTS_FLAG,
  spawnSync = require('child_process').spawnSync,
}) {
  const packaged = isPackagedExecutableRuntime();
  const command = packaged
    ? (process.env[STARTUP_PRIMARY_EXECUTABLE_ENV] || getPackagedExecutablePath())
    : process.execPath;

  const baseArgs = ['snapshot', '--projectid', projectId, ...sessionArg, ...extraArgs];
  if (sideEffectsSuppressed && sideEffectsSuppressed() && NO_SIDE_EFFECTS_FLAG) {
    baseArgs.push(NO_SIDE_EFFECTS_FLAG);
  }

  const commandArgs = packaged ? baseArgs : [resolveEntryFilename(), ...baseArgs];

  const env = sideEffectsSuppressed && sideEffectsSuppressed()
    ? { ...process.env, GAD_NO_SIDE_EFFECTS_ACTIVE: '1' }
    : process.env;

  const result = spawnSync(command, commandArgs, { stdio: 'inherit', env });
  return result.status || (result.error ? 1 : 0);
}

module.exports = { spawnSnapshot, STARTUP_PRIMARY_EXECUTABLE_ENV };
