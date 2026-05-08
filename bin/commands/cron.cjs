'use strict';
/**
 * gad cron — cross-platform scheduled task management.
 *
 * Subcommands:
 *   add      --name <n> --schedule "<cron>" --command "<gad args>"
 *   list     [--json] [--check-os]
 *   remove   --name <n>
 *   run-now  --name <n>
 *
 * Source of truth: .planning/cron.json (JSON array of entries).
 * Platform-native tasks are installed/removed in sync via:
 *   - Windows: scheduler-windows.cjs (schtasks.exe)
 *   - Unix/Mac: scheduler-unix.cjs (crontab)
 *
 * Implements GLOBAL-D-315.
 */

const path = require('path');
const { spawnSync } = require('child_process');
const { defineCommand } = require('citty');

const {
  getScheduler,
  isValidCronExpr,
  readCronJson,
  writeCronJson,
  appendCronLog,
  cronLogPath,
} = require('../../lib/cron/index.cjs');

function createCronCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError, render, shouldUseJson } = deps;

  // ---------------------------------------------------------------------------
  // Resolve planning dir for a given project context
  // ---------------------------------------------------------------------------
  function resolvePlanningDir(args) {
    const baseDir = findRepoRoot();
    const config = gadConfig.load(baseDir);
    const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
    if (roots.length === 0) {
      outputError('No project resolved. Pass --projectid <id> or run from a project root.');
      return null;
    }
    const root = roots[0];
    return path.join(
      root.path ? path.resolve(baseDir, root.path) : baseDir,
      '.planning',
    );
  }

  // Path to gad.cjs (used when building OS task commands)
  const gadCjsPath = path.resolve(__dirname, '..', 'gad.cjs');

  // ---------------------------------------------------------------------------
  // add
  // ---------------------------------------------------------------------------
  const cronAddCmd = defineCommand({
    meta: { name: 'add', description: 'Add a new cron entry and install the platform-native task.' },
    args: {
      name: { type: 'string', description: 'Unique entry name (alphanumeric + hyphens)', required: true },
      schedule: { type: 'string', description: '5-field cron expression (e.g. "0 3 * * *")', required: true },
      command: { type: 'string', description: 'gad subcommand args (e.g. "evolution evolve")', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      'dry-run': { type: 'boolean', description: 'Print the OS task command without executing it', default: false },
    },
    run({ args }) {
      const name = String(args.name).trim();
      const schedule = String(args.schedule).trim();
      const command = String(args.command).trim();
      const dryRun = Boolean(args['dry-run']);

      if (!name || !/^[\w-]+$/.test(name)) {
        outputError('--name must be non-empty and contain only word characters and hyphens.');
        process.exit(1);
      }
      if (!isValidCronExpr(schedule)) {
        outputError(`Invalid cron expression: "${schedule}". Must be 5 whitespace-separated fields.`);
        process.exit(1);
      }

      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); }

      const entries = readCronJson(planningDir);
      const existing = entries.find(e => e.name === name);
      if (existing) {
        outputError(`Entry "${name}" already exists. Remove it first with: gad cron remove --name ${name}`);
        process.exit(1);
      }

      // Write JSON first (source of truth)
      const entry = {
        name,
        schedule,
        command,
        created_at: new Date().toISOString(),
        last_run_at: null,
        enabled: true,
      };
      if (!dryRun) {
        entries.push(entry);
        writeCronJson(planningDir, entries);
      }

      // Install platform-native task
      const scheduler = getScheduler();
      const result = scheduler.installTask({ name, schedule, command, gadCjsPath, dryRun });

      if (dryRun) {
        console.log('DRY RUN — JSON entry that would be written:');
        console.log(JSON.stringify(entry, null, 2));
        if (result.command) {
          console.log('\nOS task command that would run:');
          console.log(result.command.join(' '));
        } else if (result.lines) {
          console.log('\nCrontab lines that would be written:');
          console.log(result.lines.join('\n'));
        }
        return;
      }

      if (!result.ok) {
        // Roll back JSON on OS failure
        const fresh = readCronJson(planningDir).filter(e => e.name !== name);
        writeCronJson(planningDir, fresh);
        outputError(`OS scheduler install failed: ${result.stderr || '(no detail)'}`);
        process.exit(1);
      }

      console.log(`Added cron entry "${name}".`);
      console.log(`Schedule:  ${schedule}`);
      console.log(`Command:   gad ${command}`);
    },
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  const cronListCmd = defineCommand({
    meta: { name: 'list', description: 'List all cron entries from .planning/cron.json.' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      'check-os': { type: 'boolean', description: 'Cross-check entries against OS scheduler', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); }

      const entries = readCronJson(planningDir);
      if (entries.length === 0) {
        console.log('No cron entries. Use: gad cron add --name <name> --schedule "<expr>" --command "<gad args>"');
        return;
      }

      let rows = entries.map(e => ({ ...e }));

      if (args['check-os']) {
        const scheduler = getScheduler();
        for (const row of rows) {
          row.os_installed = scheduler.taskExists(row.name);
        }
      }

      const fmt = args.json || shouldUseJson() ? 'json' : 'table';
      if (fmt === 'json') {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        const tableRows = rows.map(r => ({
          name: r.name,
          schedule: r.schedule,
          command: r.command,
          enabled: r.enabled ? 'yes' : 'no',
          last_run: r.last_run_at || '—',
          ...(args['check-os'] ? { os: r.os_installed ? 'ok' : 'MISSING' } : {}),
        }));
        console.log(render(tableRows, { format: 'table', title: `Cron entries (${rows.length})` }));
      }
    },
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  const cronRemoveCmd = defineCommand({
    meta: { name: 'remove', description: 'Remove a cron entry and uninstall the platform-native task.' },
    args: {
      name: { type: 'string', description: 'Entry name to remove', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      'dry-run': { type: 'boolean', description: 'Preview removal without executing', default: false },
    },
    run({ args }) {
      const name = String(args.name).trim();
      const dryRun = Boolean(args['dry-run']);

      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); }

      const entries = readCronJson(planningDir);
      const entry = entries.find(e => e.name === name);
      if (!entry) {
        outputError(`Entry "${name}" not found in cron.json.`);
        process.exit(1);
      }

      if (dryRun) {
        console.log(`DRY RUN — would remove entry "${name}" from cron.json and OS scheduler.`);
        return;
      }

      // Remove from JSON
      const updated = entries.filter(e => e.name !== name);
      writeCronJson(planningDir, updated);

      // Remove from OS
      const scheduler = getScheduler();
      const result = scheduler.removeTask({ name });
      if (!result.ok) {
        // JSON already updated; warn but don't fail
        process.stderr.write(`Warning: OS scheduler removal reported an error: ${result.stderr || '(no detail)'}\n`);
        process.stderr.write('JSON entry removed. You may need to clean the OS entry manually.\n');
      } else {
        console.log(`Removed cron entry "${name}".`);
      }
    },
  });

  // ---------------------------------------------------------------------------
  // run-now
  // ---------------------------------------------------------------------------
  const cronRunNowCmd = defineCommand({
    meta: { name: 'run-now', description: 'Immediately execute a cron entry\'s command (useful for testing).' },
    args: {
      name: { type: 'string', description: 'Entry name to run', required: true },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    },
    run({ args }) {
      const name = String(args.name).trim();
      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); }

      const entries = readCronJson(planningDir);
      const entry = entries.find(e => e.name === name);
      if (!entry) {
        outputError(`Entry "${name}" not found in cron.json.`);
        process.exit(1);
      }

      const commandParts = entry.command.split(/\s+/).filter(Boolean);
      const startedAt = new Date().toISOString();
      console.log(`Running: gad ${entry.command}`);

      const result = spawnSync(
        process.execPath,
        [gadCjsPath, ...commandParts],
        { stdio: 'inherit', encoding: 'utf8' },
      );

      const finishedAt = new Date().toISOString();
      const exitCode = result.status ?? 1;

      // Log run
      appendCronLog(planningDir, {
        name,
        started_at: startedAt,
        finished_at: finishedAt,
        exit_code: exitCode,
        command: entry.command,
      });

      // Update last_run_at in JSON
      const updatedEntries = readCronJson(planningDir).map(e => {
        if (e.name === name) return { ...e, last_run_at: finishedAt };
        return e;
      });
      writeCronJson(planningDir, updatedEntries);

      if (exitCode !== 0) {
        outputError(`Command exited with code ${exitCode}.`);
        process.exit(exitCode);
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Top-level
  // ---------------------------------------------------------------------------
  return defineCommand({
    meta: { name: 'cron', description: 'Manage scheduled gad tasks (Windows schtasks / Unix crontab). Source of truth: .planning/cron.json.' },
    subCommands: {
      add: cronAddCmd,
      list: cronListCmd,
      remove: cronRemoveCmd,
      'run-now': cronRunNowCmd,
    },
  });
}

module.exports = { createCronCommand };
module.exports.register = (ctx) => ({ cron: createCronCommand(ctx.common) });
