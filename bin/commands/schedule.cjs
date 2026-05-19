'use strict';
/**
 * gad schedule — unified schedule-syntax CLI.
 *
 * Wraps lib/schedule-parser/index.cjs (phase 254-02). Lets operators
 * validate, preview next-fires, and audit scheduled entries across
 * .planning/cron.json and .planning/predicates.json without spinning up
 * a hook or installing an OS task.
 *
 * Subcommands:
 *   validate  <string>                       — Parse + report kind / fields / error
 *   next-run  <string> [--count N]           — Show next N fire times (1..50)
 *   list                                     — Enumerate cron.json + predicates.json
 *                                              with parsed kind + next-run
 *
 * Phase 254-14. Renders the parser API at the CLI surface; no scheduler
 * side-effects — pure read + parse + preview.
 */

const fs = require('node:fs');
const path = require('node:path');
const { defineCommand } = require('citty');

const { parse, validate, nextRun } = require(
  path.join(__dirname, '..', '..', 'lib', 'schedule-parser', 'index.cjs')
);

function createScheduleCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    resolveRoots,
    outputError,
    render,
    shouldUseJson,
  } = deps;

  // ---------------------------------------------------------------------------
  // Project planning dir resolver (shared)
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

  // ---------------------------------------------------------------------------
  // Shape-tolerant readers for cron.json (array OR { entries: [...] })
  // and predicates.json (array)
  // ---------------------------------------------------------------------------
  function readCronEntries(planningDir) {
    const p = path.join(planningDir, 'cron.json');
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.entries)) return raw.entries;
      return [];
    } catch {
      return [];
    }
  }

  function readPredicates(planningDir) {
    const p = path.join(planningDir, 'predicates.json');
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(raw)) return raw;
      if (raw && Array.isArray(raw.entries)) return raw.entries;
      return [];
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // validate <string>
  // ---------------------------------------------------------------------------
  const validateCmd = defineCommand({
    meta: {
      name: 'validate',
      description: 'Parse a schedule string and report its kind + fields (or error).',
    },
    args: {
      schedule: {
        type: 'positional',
        description: 'Schedule string (e.g. "5m", "10hz", "0 3 * * *", "@daily", "on:commit", "when:level_delta >= 2")',
        required: true,
      },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const raw = String(args.schedule);
      const result = validate(raw);
      const wantJson = args.json || shouldUseJson();

      if (!result.valid) {
        if (wantJson) {
          console.log(JSON.stringify({ valid: false, error: result.error, raw }, null, 2));
        } else {
          console.log(`INVALID  ${raw}`);
          console.log(`         ${result.error}`);
        }
        process.exit(1);
        return;
      }

      const parsed = parse(raw);
      if (wantJson) {
        console.log(JSON.stringify({ valid: true, parsed }, null, 2));
        return;
      }

      console.log(`VALID    ${raw}`);
      console.log(`kind     ${parsed.kind}`);
      switch (parsed.kind) {
        case 'interval':
          console.log(`ms       ${parsed.ms}`);
          console.log(`unit     ${parsed.unit}`);
          console.log(`value    ${parsed.value}`);
          break;
        case 'hz':
          console.log(`hz       ${parsed.hz}`);
          console.log(`intMs    ${parsed.intervalMs}`);
          break;
        case 'cron':
          console.log(`cron     ${parsed.expression}`);
          if (parsed.shorthand) console.log(`alias    ${parsed.shorthand}`);
          break;
        case 'event':
          console.log(`event    ${parsed.event}`);
          console.log(`known    ${parsed.known ? 'yes' : 'no'}`);
          break;
        case 'predicate':
          console.log(`id       ${parsed.identifier}`);
          console.log(`op       ${parsed.op}`);
          console.log(`value    ${JSON.stringify(parsed.value)}`);
          break;
        default:
          break;
      }
    },
  });

  // ---------------------------------------------------------------------------
  // next-run <string> [--count N]
  // ---------------------------------------------------------------------------
  const nextRunCmd = defineCommand({
    meta: {
      name: 'next-run',
      description: 'Show the next N fire times for a schedule string (interval / hz / cron only).',
    },
    args: {
      schedule: {
        type: 'positional',
        description: 'Schedule string',
        required: true,
      },
      count: { type: 'string', description: 'Number of next-runs to compute (1..50, default 1)', default: '1' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const raw = String(args.schedule);
      const v = validate(raw);
      if (!v.valid) {
        outputError(`Invalid schedule "${raw}": ${v.error}`);
        process.exit(1);
        return;
      }

      const count = Math.max(1, Math.min(50, parseInt(args.count, 10) || 1));
      const parsed = parse(raw);
      const wantJson = args.json || shouldUseJson();

      if (parsed.kind === 'event' || parsed.kind === 'predicate') {
        const msg = `${parsed.kind} schedules have no deterministic fire-time (triggered by external signal).`;
        if (wantJson) {
          console.log(JSON.stringify({ kind: parsed.kind, runs: [], note: msg }, null, 2));
        } else {
          console.log(msg);
        }
        return;
      }

      const runs = [];
      let cursor = new Date();
      for (let i = 0; i < count; i++) {
        const nr = nextRun(parsed, cursor);
        if (!nr) break;
        runs.push(nr.toISOString());
        cursor = nr;
      }

      if (wantJson) {
        console.log(JSON.stringify({ kind: parsed.kind, count: runs.length, runs }, null, 2));
        return;
      }

      console.log(`Next ${runs.length} run(s) for "${raw}" (kind=${parsed.kind}):`);
      for (const iso of runs) console.log(`  ${iso}`);
    },
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  const listCmd = defineCommand({
    meta: {
      name: 'list',
      description: 'List all scheduled entries from .planning/cron.json + .planning/predicates.json with parsed kind + next-run.',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); return; }

      const rows = [];

      for (const entry of readCronEntries(planningDir)) {
        const sched = entry.schedule || entry.cron || '';
        const v = validate(sched);
        let parsed = null;
        let nrStr = '';
        if (v.valid) {
          parsed = parse(sched);
          const nr = nextRun(parsed, new Date());
          nrStr = nr ? nr.toISOString() : '(event/predicate)';
        }
        rows.push({
          source: 'cron',
          id: entry.id || entry.name || '(unnamed)',
          schedule: sched,
          kind: parsed ? parsed.kind : 'INVALID',
          enabled: entry.enabled !== false && entry.status !== 'disabled',
          next_run: nrStr,
          error: v.valid ? '' : v.error,
        });
      }

      for (const entry of readPredicates(planningDir)) {
        const sched = entry.schedule || '';
        const v = validate(sched);
        let parsed = null;
        if (v.valid) parsed = parse(sched);
        rows.push({
          source: 'predicate',
          id: entry.id || '(unnamed)',
          schedule: sched,
          kind: parsed ? parsed.kind : 'INVALID',
          enabled: entry.enabled !== false,
          next_run: '(predicate)',
          error: v.valid ? '' : v.error,
        });
      }

      const wantJson = args.json || shouldUseJson();
      if (wantJson) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }

      if (rows.length === 0) {
        console.log('No entries in .planning/cron.json or .planning/predicates.json.');
        return;
      }

      const tableRows = rows.map((r) => ({
        source: r.source,
        id: r.id,
        kind: r.kind,
        schedule: r.schedule,
        enabled: r.enabled ? 'yes' : 'no',
        next_run: r.next_run || '—',
      }));
      console.log(render(tableRows, { format: 'table', title: `Schedule entries (${rows.length})` }));

      const invalid = rows.filter((r) => r.kind === 'INVALID');
      if (invalid.length > 0) {
        console.log('');
        console.log(`${invalid.length} invalid entry(ies):`);
        for (const r of invalid) {
          console.log(`  ${r.source}/${r.id}: ${r.error}`);
        }
      }
    },
  });

  return defineCommand({
    meta: {
      name: 'schedule',
      description: 'Unified schedule-syntax helpers (validate / next-run / list). Wraps lib/schedule-parser (phase 254-02).',
    },
    subCommands: {
      validate: validateCmd,
      'next-run': nextRunCmd,
      list: listCmd,
    },
  });
}

module.exports = { createScheduleCommand };
module.exports.register = (ctx) => ({ schedule: createScheduleCommand(ctx.common) });
