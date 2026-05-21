'use strict';
/**
 * lib/win-spawn.cjs — Windows-safe child-process wrappers.
 *
 * RULE: Every spawn/spawnSync call in the GAD codebase that may run on
 * Windows MUST either (a) call one of these helpers, or (b) include
 * `windowsHide: true` explicitly in its options object.
 *
 * Without `windowsHide: true`, Node.js allocates a new console window
 * (conhost.exe) for each spawned process on Windows. This causes visible
 * popup/flash every time a worker, dispatcher, runtime, or daemon starts.
 *
 * REGRESSION GUARD: tests/spawn-windowshide.test.cjs scans team/dispatcher/
 * runtime lib sources and fails the build if any spawn call is missing
 * windowsHide or a call to these helpers. Add files to SCANNED_FILES there
 * when adding new spawn callsites.
 *
 * Public API:
 *   winSpawn(command, args, options)       → ChildProcess  (spawn)
 *   winSpawnSync(command, args, options)   → SpawnSyncResult  (spawnSync)
 *   winSpawnDetached(command, args, options, logFd?) → ChildProcess, unref'd
 */

const childProcess = require('child_process');

/**
 * Drop-in replacement for child_process.spawn that always sets windowsHide.
 * All other options are passed through unchanged.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions} [options]
 * @returns {import('child_process').ChildProcess}
 */
function winSpawn(command, args, options) {
  return childProcess.spawn(command, args || [], { ...options, windowsHide: true });
}

/**
 * Drop-in replacement for child_process.spawnSync that always sets windowsHide.
 * All other options are passed through unchanged.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnSyncOptions} [options]
 * @returns {import('child_process').SpawnSyncReturns<string>}
 */
function winSpawnSync(command, args, options) {
  return childProcess.spawnSync(command, args || [], { ...options, windowsHide: true });
}

/**
 * Spawn a detached background process with stdio redirected so no console
 * window appears and no file descriptors leak. The child is unref'd so the
 * parent can exit independently.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions & { logFd?: number }} [options]
 *   logFd: optional open file descriptor for stdout+stderr; if omitted, 'ignore'.
 * @returns {import('child_process').ChildProcess}
 */
function winSpawnDetached(command, args, options) {
  const { logFd, ...rest } = options || {};
  const stdio = logFd != null ? ['ignore', logFd, logFd] : 'ignore';
  const child = childProcess.spawn(command, args || [], {
    ...rest,
    detached: true,
    stdio,
    windowsHide: true,
    shell: rest.shell !== undefined ? rest.shell : false,
  });
  child.unref();
  return child;
}

module.exports = { winSpawn, winSpawnSync, winSpawnDetached };
