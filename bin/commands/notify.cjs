'use strict';
/**
 * gad notify — global notification substrate CLI (phase 111-01).
 *
 * Subcommands:
 *   gad notify create  --severity X --source Y --title T --message M [--expires-at ISO] [--fingerprint F] [--projectid id]
 *   gad notify list    [--severity X] [--source Y] [--include-dismissed] [--json]
 *   gad notify dismiss <id>
 *   gad notify clear-expired
 *   gad notify summary [--json]
 *
 * Storage: <planningDir>/notifications/active.jsonl
 * Archive: <planningDir>/notifications/archive/<YYYY-MM-DD>.jsonl
 *
 * This module uses the new-style auto-loader contract:
 *   exports.register(ctx) → { notify: cmdDef }
 * No bin/gad.cjs edits required.
 */

const { defineCommand } = require('citty');

const {
  createNotification,
  listActive,
  dismissNotification,
  clearExpired,
  summarize,
} = require('../../lib/notifications/index.cjs');

// ---------------------------------------------------------------------------
// Resolve baseDir for a given invocation.
// Uses projectid + gadConfig/resolveRoots when available (hooked up through
// ctx.common by the factory), but gracefully falls back to findRepoRoot()
// from lib/notifications when deps are absent (e.g. standalone testing).
// ---------------------------------------------------------------------------

function resolveBaseDir(deps, projectid) {
  const { findRepoRoot, gadConfig, resolveRoots } = deps;
  if (gadConfig && resolveRoots && projectid) {
    try {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid }, baseDir, config.roots);
      if (Array.isArray(roots) && roots.length > 0) {
        return baseDir; // notifications live at repo root, not per-project dir
      }
    } catch { /* fall through */ }
  }
  if (findRepoRoot) {
    try { return findRepoRoot(); } catch { /* fall through */ }
  }
  // Last resort — lib/notifications resolves its own repo root.
  return undefined;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function createNotifyCreateCmd(deps) {
  const { outputError } = deps;
  return defineCommand({
    meta: { name: 'create', description: 'Create a new notification in .planning/notifications/active.jsonl' },
    args: {
      severity: { type: 'string', description: '"info" | "warn" | "error" | "critical"', required: true },
      source:   { type: 'string', description: 'Originating subsystem (e.g. "dispatcher", "manual")', required: true },
      title:    { type: 'string', description: 'Short one-line title', required: true },
      message:  { type: 'string', description: 'Full notification body', required: true },
      'expires-at': { type: 'string', description: 'ISO expiry timestamp (default: now + 24h)', default: '' },
      fingerprint:  { type: 'string', description: 'Dedup key — prevents duplicate active entries', default: '' },
      projectid:    { type: 'string', description: 'Project scope (used to locate repo root)', default: '' },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(deps, args.projectid || '');
      try {
        const result = createNotification({
          severity: args.severity,
          source: args.source,
          title: args.title,
          message: args.message,
          expires_at: args['expires-at'] || undefined,
          fingerprint: args.fingerprint || undefined,
          _baseDir: baseDir,
        });
        if (result.created) {
          console.log(JSON.stringify({ id: result.id, created: true }));
        } else {
          console.log(JSON.stringify({ id: result.id, created: false, note: 'fingerprint dedup — existing entry returned' }));
        }
      } catch (e) {
        if (outputError) outputError(e.message);
        else console.error(e.message);
        process.exit(1);
      }
    },
  });
}

function createNotifyListCmd(deps) {
  const { outputError, render } = deps;
  return defineCommand({
    meta: { name: 'list', description: 'List active (non-expired, non-dismissed) notifications' },
    args: {
      severity:           { type: 'string',  description: 'Filter by severity', default: '' },
      source:             { type: 'string',  description: 'Filter by source',   default: '' },
      'include-dismissed': { type: 'boolean', description: 'Include dismissed entries', default: false },
      since:              { type: 'string',  description: 'Only entries with ts >= this ISO timestamp', default: '' },
      json:               { type: 'boolean', description: 'JSON output',        default: false },
      projectid:          { type: 'string',  description: 'Project scope',      default: '' },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(deps, args.projectid || '');
      try {
        let entries = listActive({
          severity: args.severity || undefined,
          source: args.source || undefined,
          includeDismissed: args['include-dismissed'],
          _baseDir: baseDir,
        });

        // --since filter (phase 111 consumer support: SessionStart wants
        // entries newer than the last session-start timestamp).
        if (args.since) {
          const sinceMs = Date.parse(args.since);
          if (Number.isFinite(sinceMs)) {
            entries = entries.filter(e => {
              const ts = e.ts ? Date.parse(e.ts) : 0;
              return Number.isFinite(ts) && ts >= sinceMs;
            });
          }
        }

        if (args.json) {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        if (entries.length === 0) {
          console.log('No active notifications.');
          return;
        }

        if (render) {
          const rows = entries.map(e => ({
            id: e.id,
            severity: e.severity,
            source: e.source,
            title: e.title,
            ts: e.ts ? e.ts.slice(0, 19).replace('T', ' ') : '',
            expires: e.expires_at ? e.expires_at.slice(0, 19).replace('T', ' ') : '',
            dismissed: e.dismissed ? 'yes' : '',
          }));
          console.log(render(rows, { format: 'table', title: 'Notifications' }));
        } else {
          for (const e of entries) {
            console.log(`[${e.severity.toUpperCase()}] ${e.id}  ${e.source}  ${e.title}`);
          }
        }
      } catch (e) {
        if (outputError) outputError(e.message);
        else console.error(e.message);
        process.exit(1);
      }
    },
  });
}

function createNotifyDismissCmd(deps) {
  const { outputError } = deps;
  return defineCommand({
    meta: { name: 'dismiss', description: 'Mark a notification as dismissed by id' },
    args: {
      id:        { type: 'positional', description: 'Notification id (not-<ts>-<rand4>)', required: true },
      projectid: { type: 'string',  description: 'Project scope', default: '' },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(deps, args.projectid || '');
      try {
        const result = dismissNotification(args.id, baseDir);
        if (result.found) {
          console.log(`Dismissed: ${args.id}`);
        } else {
          console.log(`Not found: ${args.id}`);
          process.exit(1);
        }
      } catch (e) {
        if (outputError) outputError(e.message);
        else console.error(e.message);
        process.exit(1);
      }
    },
  });
}

function createNotifyDismissAllCmd(deps) {
  const { outputError } = deps;
  return defineCommand({
    meta: { name: 'dismiss-all', description: 'Mark all active notifications as dismissed (filter by --severity / --source)' },
    args: {
      severity:  { type: 'string', description: 'Only dismiss entries matching this severity', default: '' },
      source:    { type: 'string', description: 'Only dismiss entries matching this source',   default: '' },
      projectid: { type: 'string', description: 'Project scope', default: '' },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(deps, args.projectid || '');
      try {
        const entries = listActive({
          severity: args.severity || undefined,
          source: args.source || undefined,
          _baseDir: baseDir,
        });
        let n = 0;
        for (const e of entries) {
          const r = dismissNotification(e.id, baseDir);
          if (r.found) n++;
        }
        console.log(`Dismissed ${n} notification(s).`);
      } catch (e) {
        if (outputError) outputError(e.message);
        else console.error(e.message);
        process.exit(1);
      }
    },
  });
}

function createNotifyClearExpiredCmd(deps) {
  const { outputError } = deps;
  return defineCommand({
    meta: { name: 'clear-expired', description: 'Move expired notifications from active.jsonl to archive/<date>.jsonl' },
    args: {
      projectid: { type: 'string', description: 'Project scope', default: '' },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(deps, args.projectid || '');
      try {
        const count = clearExpired(baseDir);
        console.log(`Archived ${count} expired notification(s).`);
      } catch (e) {
        if (outputError) outputError(e.message);
        else console.error(e.message);
        process.exit(1);
      }
    },
  });
}

function createNotifySummaryCmd(deps) {
  const { outputError, render } = deps;
  return defineCommand({
    meta: { name: 'summary', description: 'Summarize active notifications — counts by severity. Used by statusline.' },
    args: {
      json:      { type: 'boolean', description: 'JSON output', default: false },
      projectid: { type: 'string',  description: 'Project scope', default: '' },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(deps, args.projectid || '');
      try {
        const result = summarize({ _baseDir: baseDir });

        if (args.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const { counts, mostRecentSeverity, total } = result;
        if (total === 0) {
          console.log('No active notifications.');
          return;
        }

        if (render) {
          const rows = [
            { severity: 'critical', count: counts.critical },
            { severity: 'error',    count: counts.error    },
            { severity: 'warn',     count: counts.warn     },
            { severity: 'info',     count: counts.info     },
          ].filter(r => r.count > 0);
          console.log(render(rows, { format: 'table', title: `Notifications (total: ${total})` }));
          console.log(`Most recent severity: ${mostRecentSeverity || 'n/a'}`);
        } else {
          console.log(`total=${total}  critical=${counts.critical}  error=${counts.error}  warn=${counts.warn}  info=${counts.info}`);
          console.log(`mostRecentSeverity=${mostRecentSeverity || 'n/a'}`);
        }
      } catch (e) {
        if (outputError) outputError(e.message);
        else console.error(e.message);
        process.exit(1);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createNotifyCommand(deps) {
  return defineCommand({
    meta: { name: 'notify', description: 'Global notification substrate — create / list / dismiss / clear-expired / summary' },
    subCommands: {
      create:         createNotifyCreateCmd(deps),
      list:           createNotifyListCmd(deps),
      dismiss:        createNotifyDismissCmd(deps),
      'dismiss-all':  createNotifyDismissAllCmd(deps),
      'clear-expired': createNotifyClearExpiredCmd(deps),
      summary:        createNotifySummaryCmd(deps),
    },
  });
}

// ---------------------------------------------------------------------------
// Auto-loader contract
// ---------------------------------------------------------------------------

module.exports = { createNotifyCommand };
module.exports.register = (ctx) => ({
  notify: createNotifyCommand(ctx.common),
});
