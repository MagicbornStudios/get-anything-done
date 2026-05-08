'use strict';
/**
 * Windows Task Scheduler wrapper for gad cron.
 * Uses schtasks.exe to install/remove/query scheduled tasks.
 *
 * Task naming convention: "gad-cron-<name>"
 * Command: node <gad.cjs path> <gad-subcommand-args>
 */

const { spawnSync } = require('child_process');
const path = require('path');

const GAD_TASK_PREFIX = 'gad-cron-';

/**
 * Map a 5-field cron expression to a schtasks /SC frequency.
 * Handles common simple cases; falls back to MINUTE for complex expressions.
 *
 * @param {string} cronExpr - 5-field cron expression
 * @returns {{ sc: string, modArgs: string[] }} schtasks /SC + additional modifier args
 */
function mapCronToSchtasks(cronExpr) {
  const [minute, hour, dom, month, dow] = cronExpr.trim().split(/\s+/);

  // Every minute: * * * * *
  if (minute === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return { sc: 'MINUTE', modArgs: ['/MO', '1'] };
  }

  // Hourly: 0 * * * *  (any fixed minute, every hour)
  if (hour === '*' && dom === '*' && month === '*' && dow === '*' && /^\d+$/.test(minute)) {
    return { sc: 'HOURLY', modArgs: [] };
  }

  // Daily: <min> <hour> * * *
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dom === '*' && month === '*' && dow === '*') {
    return { sc: 'DAILY', modArgs: ['/ST', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`] };
  }

  // Weekly: <min> <hour> * * <dow>
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dom === '*' && month === '*' && /^\d+$/.test(dow)) {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayName = days[parseInt(dow, 10)] || 'MON';
    return { sc: 'WEEKLY', modArgs: ['/D', dayName, '/ST', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`] };
  }

  // Monthly: <min> <hour> <dom> * *
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && month === '*' && dow === '*') {
    return { sc: 'MONTHLY', modArgs: ['/D', dom, '/ST', `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`] };
  }

  // Fallback: MINUTE with 1-minute interval (most permissive)
  return { sc: 'MINUTE', modArgs: ['/MO', '1'] };
}

/**
 * Install a scheduled task via schtasks.exe.
 *
 * @param {object} opts
 * @param {string} opts.name - Entry name (will become "gad-cron-<name>")
 * @param {string} opts.schedule - 5-field cron expression
 * @param {string} opts.command - gad subcommand string (e.g. "evolution evolve")
 * @param {string} opts.gadCjsPath - Absolute path to gad.cjs
 * @param {boolean} [opts.dryRun] - If true, return the command without executing
 * @returns {{ ok: boolean, stdout: string, stderr: string, command?: string[] }}
 */
function installTask(opts) {
  const { name, schedule, command, gadCjsPath, dryRun = false } = opts;
  const taskName = `${GAD_TASK_PREFIX}${name}`;
  const { sc, modArgs } = mapCronToSchtasks(schedule);
  const nodeExe = process.execPath;
  const taskRun = `"${nodeExe}" "${gadCjsPath}" ${command}`;

  const argv = [
    '/Create',
    '/TN', taskName,
    '/TR', taskRun,
    '/SC', sc,
    ...modArgs,
    '/F',  // overwrite if exists
  ];

  if (dryRun) {
    return { ok: true, stdout: '', stderr: '', command: ['schtasks', ...argv] };
  }

  const result = spawnSync('schtasks', argv, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * Remove a scheduled task via schtasks.exe.
 *
 * @param {object} opts
 * @param {string} opts.name - Entry name
 * @param {boolean} [opts.dryRun] - If true, return the command without executing
 * @returns {{ ok: boolean, stdout: string, stderr: string, command?: string[] }}
 */
function removeTask(opts) {
  const { name, dryRun = false } = opts;
  const taskName = `${GAD_TASK_PREFIX}${name}`;
  const argv = ['/Delete', '/TN', taskName, '/F'];

  if (dryRun) {
    return { ok: true, stdout: '', stderr: '', command: ['schtasks', ...argv] };
  }

  const result = spawnSync('schtasks', argv, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * Query whether a task exists in the OS scheduler.
 *
 * @param {string} name - Entry name
 * @returns {boolean}
 */
function taskExists(name) {
  const taskName = `${GAD_TASK_PREFIX}${name}`;
  const result = spawnSync('schtasks', ['/Query', '/TN', taskName], { encoding: 'utf8' });
  return result.status === 0;
}

module.exports = { installTask, removeTask, taskExists, mapCronToSchtasks, GAD_TASK_PREFIX };
