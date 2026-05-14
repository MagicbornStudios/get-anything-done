'use strict';
/**
 * gad supervisor — control the GAD supervisor daemon.
 *
 * Subcommands:
 *   gad supervisor run  [--projectid Z]   internal: daemon loop entry (spawned by system start)
 *   gad supervisor status                 show pidfile + alive state
 *   gad supervisor stop                   SIGTERM the daemon
 *
 * The supervisor ticks every 60s and auto-recovers:
 *   - stuck handoffs (claimed >30min) → move back to open/
 *   - stale workers (heartbeat >300s) → gad team restart --worker-id
 *   - quota-exhausted accounts         → gad accounts rotate
 *   - dead dispatcher                  → gad team dispatcher start
 *
 * Design: lib/supervisor-agent.cjs
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const {
  runDaemon,
  tick: supervisorTick,
  supervisorPidPath,
  supervisorLogPath,
} = require('../../lib/supervisor-agent.cjs');

function isAlive(pid) {
  if (!pid || !Number.isFinite(Number(pid))) return false;
  try { process.kill(Number(pid), 0); return true; } catch { return false; }
}

function readPid(baseDir) {
  const p = supervisorPidPath(baseDir);
  try { return parseInt(fs.readFileSync(p, 'utf8').trim(), 10); } catch { return null; }
}

function createSupervisorCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveTarget(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return { baseDir: repoRoot, projectid: pidArg || '' };
    return { baseDir: path.join(repoRoot, root.path), projectid: root.id || pidArg || '' };
  }

  const PROJECTID_ARG = { type: 'string', description: 'Target project id', default: '' };

  const runCmd = defineCommand({
    meta: { name: 'run', description: 'Internal: daemon loop (spawned by gad system start as a detached subprocess).' },
    args: { projectid: PROJECTID_ARG },
    async run({ args }) {
      const { baseDir, projectid } = resolveTarget(args);
      await runDaemon(baseDir, { projectid });
    },
  });

  const statusCmd = defineCommand({
    meta: { name: 'status', description: 'Report supervisor liveness.' },
    args: {
      projectid: PROJECTID_ARG,
      json: { type: 'boolean', default: false },
    },
    run({ args }) {
      const { baseDir } = resolveTarget(args);
      const pid = readPid(baseDir);
      const alive = isAlive(pid);
      const logPath = supervisorLogPath(baseDir);
      if (args.json) {
        console.log(JSON.stringify({ pid, alive, log: logPath }, null, 2));
        return;
      }
      const state = pid ? (alive ? `RUNNING (pid ${pid})` : `STALE (pid ${pid} dead)`) : 'not running';
      console.log(`Supervisor: ${state}`);
      console.log(`  log: ${logPath}`);
    },
  });

  // 2026-05-14 (GLOBAL-D-347): one-shot tick for desk-hook invocation.
  // Replaces the long-running daemon loop when called from apps/desk hooks.
  const tickCmd = defineCommand({
    meta: { name: 'tick', description: 'Run a single supervisor pass (one-shot, useful for cron / desk hooks). Equivalent to one iteration of `gad supervisor run`.' },
    args: { projectid: PROJECTID_ARG },
    run({ args }) {
      const { baseDir, projectid } = resolveTarget(args);
      const interventions = [];
      supervisorTick(baseDir, projectid, (entry) => interventions.push(entry));
      if (interventions.length === 0) {
        console.log('OK supervisor tick — no interventions');
        return;
      }
      console.log(`OK supervisor tick — ${interventions.length} intervention(s):`);
      for (const e of interventions) {
        console.log(`  ${e.kind || 'action'}: ${e.summary || JSON.stringify(e).slice(0, 120)}`);
      }
    },
  });

  const stopCmd = defineCommand({
    meta: { name: 'stop', description: 'Send SIGTERM to the supervisor daemon.' },
    args: { projectid: PROJECTID_ARG },
    run({ args }) {
      const { baseDir } = resolveTarget(args);
      const pid = readPid(baseDir);
      if (!pid) { console.log('Supervisor not running (no pid file).'); return; }
      if (!isAlive(pid)) {
        console.log(`Stale pid file (pid=${pid} not alive). Clearing.`);
        try { fs.unlinkSync(supervisorPidPath(baseDir)); } catch {}
        return;
      }
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`Sent SIGTERM to supervisor pid=${pid}.`);
      } catch (err) {
        if (outputError) outputError(`Kill failed: ${err.message}`);
        else console.error(`Kill failed: ${err.message}`);
        process.exit(1);
      }
    },
  });

  return defineCommand({
    meta: { name: 'supervisor', description: 'GAD substrate supervisor daemon — auto-recovers stuck handoffs, stale workers, exhausted accounts, dead dispatcher.' },
    subCommands: { run: runCmd, tick: tickCmd, status: statusCmd, stop: stopCmd },
  });
}

module.exports = { createSupervisorCommand };
module.exports.register = (ctx) => ({ supervisor: createSupervisorCommand(ctx.common) });
