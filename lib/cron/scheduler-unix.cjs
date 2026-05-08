'use strict';
/**
 * Unix crontab wrapper for gad cron.
 * Reads/writes the user's crontab to install/remove gad-managed entries.
 *
 * Each managed entry is flanked by comment sentinels:
 *   # gad-cron-begin:<name>
 *   <cron-expression> <command>
 *   # gad-cron-end:<name>
 */

const { spawnSync, execFileSync } = require('child_process');

const SENTINEL_BEGIN = (name) => `# gad-cron-begin:${name}`;
const SENTINEL_END = (name) => `# gad-cron-end:${name}`;

/**
 * Read the current user crontab. Returns empty string if no crontab set.
 * @param {boolean} [dryRun]
 * @returns {string}
 */
function readCrontab(dryRun = false) {
  if (dryRun) return '';
  const result = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
  // exit 1 with "no crontab" is normal on macOS/Linux
  if (result.status !== 0) return '';
  return result.stdout || '';
}

/**
 * Write the given text as the user's crontab.
 * @param {string} content
 * @param {boolean} [dryRun]
 */
function writeCrontab(content, dryRun = false) {
  if (dryRun) return;
  const result = spawnSync('crontab', ['-'], {
    input: content,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`crontab write failed: ${result.stderr}`);
  }
}

/**
 * Install a cron entry. Replaces existing sentinel block if present.
 *
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} opts.schedule - 5-field cron expression
 * @param {string} opts.command - gad subcommand args (e.g. "evolution evolve")
 * @param {string} opts.gadCjsPath - Absolute path to gad.cjs
 * @param {boolean} [opts.dryRun]
 * @returns {{ ok: boolean, stderr?: string, lines?: string[] }}
 */
function installTask(opts) {
  const { name, schedule, command, gadCjsPath, dryRun = false } = opts;
  const nodeExe = process.execPath;
  const fullCommand = `${nodeExe} "${gadCjsPath}" ${command}`;
  const block = [
    SENTINEL_BEGIN(name),
    `${schedule} ${fullCommand}`,
    SENTINEL_END(name),
  ].join('\n');

  try {
    const current = readCrontab(dryRun);
    const cleaned = removeBlock(current, name);
    const updated = cleaned.trimEnd() ? `${cleaned.trimEnd()}\n${block}\n` : `${block}\n`;

    if (dryRun) {
      return { ok: true, lines: updated.split('\n') };
    }
    writeCrontab(updated);
    return { ok: true };
  } catch (e) {
    return { ok: false, stderr: e.message };
  }
}

/**
 * Remove the sentinel block for `name` from a crontab string.
 * @param {string} content
 * @param {string} name
 * @returns {string}
 */
function removeBlock(content, name) {
  const begin = SENTINEL_BEGIN(name);
  const end = SENTINEL_END(name);
  const lines = content.split('\n');
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (line.trim() === begin) { inside = true; continue; }
    if (line.trim() === end) { inside = false; continue; }
    if (!inside) out.push(line);
  }
  return out.join('\n');
}

/**
 * Remove a cron entry.
 * @param {object} opts
 * @param {string} opts.name
 * @param {boolean} [opts.dryRun]
 * @returns {{ ok: boolean, stderr?: string }}
 */
function removeTask(opts) {
  const { name, dryRun = false } = opts;
  try {
    const current = readCrontab(dryRun);
    const updated = removeBlock(current, name);
    if (!dryRun) writeCrontab(updated);
    return { ok: true };
  } catch (e) {
    return { ok: false, stderr: e.message };
  }
}

/**
 * Check whether the sentinel block for `name` exists in the user crontab.
 * @param {string} name
 * @returns {boolean}
 */
function taskExists(name) {
  const current = readCrontab();
  return current.includes(SENTINEL_BEGIN(name));
}

module.exports = { installTask, removeTask, taskExists, readCrontab, writeCrontab, removeBlock };
