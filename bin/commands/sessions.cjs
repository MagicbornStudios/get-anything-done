'use strict';
/**
 * bin/commands/sessions.cjs — gad sessions subcommands.
 *
 * Phase 89 — session telemetry CLI surface.
 *
 * Subcommands:
 *   gad sessions list    [--projectid X] [--json]
 *   gad sessions tail    <session-id> [--watch] [--runtime R]
 *   gad sessions stats   [--projectid X] [--since 7d|YYYY-MM-DD] [--json]
 *   gad sessions preserve <session-id> [--out <dir>]
 *
 * Auto-loaded by bin/commands/_loader.cjs — no edits to bin/gad.cjs required.
 * Module exports: { register }
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const {
  loadSessionStats,
  preserveSession,
  tailSession,
  findProjectRoot,
  sessionsDir,
} = require('../../lib/session-telemetry/index.cjs');

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveRoot(args, common) {
  // Try common.findRepoRoot() first (injected dep), then fall back to
  // the standalone finder from session-telemetry.
  if (common && typeof common.findRepoRoot === 'function') {
    try { return common.findRepoRoot(); } catch { /* fall through */ }
  }
  return findProjectRoot(process.cwd());
}

function listTelemetryFiles(projectRoot) {
  const dir = sessionsDir(projectRoot);
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.telemetry.jsonl'))
      .map((f) => ({
        sessionId: f.replace(/\.telemetry\.jsonl$/, ''),
        file: path.join(dir, f),
        size: (() => { try { return fs.statSync(path.join(dir, f)).size; } catch { return 0; } })(),
        mtime: (() => { try { return fs.statSync(path.join(dir, f)).mtime.toISOString(); } catch { return null; } })(),
      }))
      .sort((a, b) => (b.mtime || '').localeCompare(a.mtime || ''));
  } catch {
    return [];
  }
}

// ── list ─────────────────────────────────────────────────────────────────────

const sessionsListCmd = defineCommand({
  meta: { name: 'list', description: 'List telemetry session files in .planning/sessions/' },
  args: {
    projectid: { type: 'string', description: 'Scope to a project (unused currently; included for consistency)', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args, _common }) {
    const root = findProjectRoot(process.cwd());
    if (!root) {
      if (args.json) { console.log('[]'); return; }
      console.log('No project root found (no .planning/ directory in path).');
      return;
    }

    const files = listTelemetryFiles(root);

    if (args.json) {
      console.log(JSON.stringify(files, null, 2));
      return;
    }

    if (files.length === 0) {
      console.log('No telemetry sessions found in .planning/sessions/');
      return;
    }

    console.log(`Sessions (${files.length}):`);
    for (const f of files) {
      const sizeKb = f.size > 0 ? `${(f.size / 1024).toFixed(1)} KB` : '0 B';
      console.log(`  ${f.sessionId}  ${sizeKb}  ${f.mtime || '—'}`);
    }
  },
});

// ── tail ─────────────────────────────────────────────────────────────────────

const sessionsTailCmd = defineCommand({
  meta: { name: 'tail', description: 'Tail telemetry events for a session' },
  args: {
    sessionId: { type: 'positional', description: 'Session id (e.g. s-20260507-abcdef12)', required: true },
    watch: { type: 'boolean', description: 'Keep watching for new events (poll every 500 ms)', default: false },
    runtime: { type: 'string', description: 'Filter by runtime (e.g. claude-code)', default: '' },
    json: { type: 'boolean', description: 'Output each event as JSON', default: false },
  },
  async run({ args }) {
    const root = findProjectRoot(process.cwd());
    if (!root) {
      process.stderr.write('gad sessions tail: cannot locate project root\n');
      process.exit(1);
      return;
    }

    const sessionId = String(args.sessionId || '').trim();
    if (!sessionId) {
      process.stderr.write('gad sessions tail: sessionId is required\n');
      process.exit(1);
      return;
    }

    const runtimeFilter = args.runtime ? String(args.runtime).trim() : null;

    console.log(`Tailing session ${sessionId}${args.watch ? ' (--watch)' : ''}...`);

    for await (const event of tailSession({ sessionId, projectRoot: root, follow: args.watch })) {
      if (runtimeFilter && event.runtime !== runtimeFilter) continue;
      if (args.json) {
        console.log(JSON.stringify(event));
      } else {
        const rt = event.runtime || '?';
        const kind = event.kind || '?';
        const ts = event.ts ? event.ts.slice(11, 19) : '—';
        const extra = event.tool ? ` tool=${event.tool}` : event.intent ? ` intent=${event.intent}` : '';
        console.log(`[${ts}] ${rt}  ${kind}${extra}`);
      }
    }
  },
});

// ── stats ─────────────────────────────────────────────────────────────────────

const sessionsStatsCmd = defineCommand({
  meta: { name: 'stats', description: 'Aggregate stats across telemetry sessions' },
  args: {
    projectid: { type: 'string', description: 'Project id (used for root resolution hint)', default: '' },
    since: { type: 'string', description: 'Filter since date: "7d", "30d", or "YYYY-MM-DD"', default: '' },
    json: { type: 'boolean', description: 'JSON output', default: false },
  },
  run({ args }) {
    const root = findProjectRoot(process.cwd());
    const stats = loadSessionStats({
      projectRoot: root || undefined,
      since: args.since || undefined,
    });

    if (args.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(`Session telemetry stats${args.since ? ` (since ${args.since})` : ''}:`);
    console.log(`  total_sessions        : ${stats.total_sessions}`);
    console.log(`  retry_rate            : ${stats.retry_rate}`);
    console.log(`  avg_tool_calls/task   : ${stats.avg_tool_calls_per_task}`);

    const runtimes = Object.entries(stats.events_per_runtime);
    if (runtimes.length > 0) {
      console.log('  events_per_runtime    :');
      for (const [rt, count] of runtimes) {
        console.log(`    ${rt}: ${count}`);
      }
    } else {
      console.log('  events_per_runtime    : (none)');
    }

    const decompKeys = Object.keys(stats.decomposition_depth_histogram);
    if (decompKeys.length > 0) {
      console.log('  decomposition_depth   :');
      for (const k of decompKeys.sort()) {
        console.log(`    depth=${k}: ${stats.decomposition_depth_histogram[k]}`);
      }
    }
  },
});

// ── preserve ─────────────────────────────────────────────────────────────────

const sessionsPreserveCmd = defineCommand({
  meta: { name: 'preserve', description: 'Copy a session telemetry file to a chosen directory for dataset use' },
  args: {
    sessionId: { type: 'positional', description: 'Session id to preserve', required: true },
    out: { type: 'string', description: 'Destination directory (default: data/sessions/)', default: '' },
  },
  run({ args }) {
    const root = findProjectRoot(process.cwd());
    if (!root) {
      process.stderr.write('gad sessions preserve: cannot locate project root\n');
      process.exit(1);
      return;
    }

    const sessionId = String(args.sessionId || '').trim();
    if (!sessionId) {
      process.stderr.write('gad sessions preserve: sessionId is required\n');
      process.exit(1);
      return;
    }

    const outDir = args.out
      ? path.resolve(args.out)
      : path.join(root, 'data', 'sessions');

    try {
      const dest = preserveSession({ sessionId, projectRoot: root, outDir });
      console.log(`Preserved: ${dest}`);
    } catch (err) {
      process.stderr.write(`gad sessions preserve: ${err.message}\n`);
      process.exit(1);
    }
  },
});

// ── root command ──────────────────────────────────────────────────────────────

const sessionsCmd = defineCommand({
  meta: { name: 'sessions', description: 'Inspect and manage session telemetry (phase 89)' },
  subCommands: {
    list: sessionsListCmd,
    tail: sessionsTailCmd,
    stats: sessionsStatsCmd,
    preserve: sessionsPreserveCmd,
  },
});

// ── loader contract ───────────────────────────────────────────────────────────

function register(_ctx) {
  return { sessions: sessionsCmd };
}

module.exports = { register };
