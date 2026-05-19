'use strict';
/**
 * gad event — emit + list events; dispatch `on:<event>` cron subscribers.
 *
 * Phase 254-03. Pairs with lib/cron/runner.cjs (event-bus). Standard
 * dispatch path:
 *   gad event emit <event> [--payload <json>] [--dry-run]
 *     1. Writes a single `{type:"emit", event, ts, payload, ...}` line to
 *        .planning/.gad-log/events-YYYY-MM-DD.jsonl
 *     2. Looks up every cron.json entry with `schedule: "on:<event>"`
 *     3. Spawns each subscriber's `command` via node gad.cjs
 *     4. Appends one `{type:"dispatch", ...}` line per subscriber
 *
 *   gad event list [--event <name>] [--limit N]
 *     Replays the last N lines from today's events log (default 50).
 *
 * Subscriber wiring uses the schedule-parser unified syntax (phase 254-02).
 * Predicate (`when:`) and time-based (interval/cron) schedules are ignored
 * here — those are dispatched by their own paths.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

const {
  emitEvent,
  listEventSubscribers,
  eventsLogPath,
} = require('../../lib/cron/runner.cjs');

function createEventCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    resolveRoots,
    outputError,
    render,
    shouldUseJson,
  } = deps;

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

  const gadCjsPath = path.resolve(__dirname, '..', 'gad.cjs');

  // -------------------------------------------------------------------------
  // emit <event>
  // -------------------------------------------------------------------------
  const emitCmd = defineCommand({
    meta: {
      name: 'emit',
      description: 'Emit an event; logs to events-YYYY-MM-DD.jsonl and dispatches all `on:<event>` cron subscribers.',
    },
    args: {
      event: {
        type: 'positional',
        description: 'Event name (no `on:` prefix). E.g. commit, phase-close, level-up, task-stamp.',
        required: true,
      },
      payload: { type: 'string', description: 'Optional JSON payload string', default: '' },
      'dry-run': { type: 'boolean', description: 'Log emit + list subscribers, but do not dispatch.', default: false },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const event = String(args.event).trim();
      if (!event || !/^[a-zA-Z0-9_-]+$/.test(event)) {
        outputError('Event name must match /^[a-zA-Z0-9_-]+$/.');
        process.exit(1);
        return;
      }

      let payload = null;
      if (args.payload && String(args.payload).trim()) {
        try {
          payload = JSON.parse(String(args.payload));
        } catch (e) {
          outputError(`--payload must be valid JSON: ${e.message}`);
          process.exit(1);
          return;
        }
      }

      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); return; }

      const result = emitEvent({
        planningDir,
        event,
        payload,
        gadCjsPath,
        dryRun: Boolean(args['dry-run']),
      });

      const wantJson = args.json || shouldUseJson();
      if (wantJson) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(`emitted event "${event}" — ${result.subscribers} subscriber(s)`);
      for (const run of result.runs) {
        const status = run.dry_run ? 'dry-run' : `exit=${run.exit_code}`;
        console.log(`  ${run.name}  ${status}  ${run.command}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  const listCmd = defineCommand({
    meta: {
      name: 'list',
      description: 'Replay recent lines from today\'s events log.',
    },
    args: {
      event: { type: 'string', description: 'Filter by event name', default: '' },
      limit: { type: 'string', description: 'Max lines to print (default 50)', default: '50' },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); return; }
      const logPath = eventsLogPath(planningDir);
      let lines = [];
      try {
        const raw = fs.readFileSync(logPath, 'utf8');
        lines = raw.split(/\r?\n/).filter((l) => l.trim());
      } catch {
        // file missing — empty result
      }
      const filter = String(args.event || '').trim();
      const limit = Math.max(1, Math.min(1000, parseInt(args.limit, 10) || 50));

      const parsed = [];
      for (const l of lines) {
        try {
          const obj = JSON.parse(l);
          if (filter && obj.event !== filter) continue;
          parsed.push(obj);
        } catch {
          // skip malformed lines
        }
      }
      const tail = parsed.slice(-limit);

      const wantJson = args.json || shouldUseJson();
      if (wantJson) {
        console.log(JSON.stringify({ path: logPath, count: tail.length, lines: tail }, null, 2));
        return;
      }
      if (tail.length === 0) {
        console.log(`No events logged today${filter ? ` for "${filter}"` : ''}.`);
        return;
      }
      const rows = tail.map((e) => ({
        ts: e.ts || '',
        type: e.type || '',
        event: e.event || '',
        detail:
          e.type === 'dispatch'
            ? `${e.name || '-'} exit=${e.exit_code ?? '-'}`
            : `subs=${e.subscriber_count ?? '-'}`,
      }));
      console.log(render(rows, { format: 'table', title: `Events (${rows.length})` }));
    },
  });

  // -------------------------------------------------------------------------
  // subscribers <event>
  // -------------------------------------------------------------------------
  const subsCmd = defineCommand({
    meta: {
      name: 'subscribers',
      description: 'List cron.json entries subscribed to a given event (`on:<event>`).',
    },
    args: {
      event: {
        type: 'positional',
        description: 'Event name (no `on:` prefix).',
        required: true,
      },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const event = String(args.event).trim();
      const planningDir = resolvePlanningDir(args);
      if (!planningDir) { process.exit(1); return; }
      const subs = listEventSubscribers(planningDir, event);
      const wantJson = args.json || shouldUseJson();
      if (wantJson) {
        console.log(JSON.stringify({ event, count: subs.length, subscribers: subs }, null, 2));
        return;
      }
      if (subs.length === 0) {
        console.log(`No subscribers for "on:${event}".`);
        return;
      }
      const rows = subs.map((s) => ({
        id: s.id || s.name || '(unnamed)',
        schedule: s.schedule,
        command: s.command,
        enabled: s.enabled !== false && s.status !== 'disabled' ? 'yes' : 'no',
      }));
      console.log(render(rows, { format: 'table', title: `Subscribers for on:${event}` }));
    },
  });

  return defineCommand({
    meta: {
      name: 'event',
      description: 'Emit + inspect events; dispatch `on:<event>` cron subscribers. Source of truth: .planning/cron.json + .planning/.gad-log/events-YYYY-MM-DD.jsonl.',
    },
    subCommands: {
      emit: emitCmd,
      list: listCmd,
      subscribers: subsCmd,
    },
  });
}

module.exports = { createEventCommand };
module.exports.register = (ctx) => ({ event: createEventCommand(ctx.common) });
