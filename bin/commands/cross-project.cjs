'use strict';
/**
 * gad cross-project — Cross-project handoff watcher + listing.
 *
 * Subcommands:
 *   gad cross-project watch --daemon [--tick-seconds N]
 *     Long-running daemon: polls planning roots every N seconds (default 30),
 *     emits OS-visible log lines for new handoffs. The frontend
 *     (apps/desktop/src/lib/cross-project-watch.ts) invokes `list --json`
 *     instead of relying on daemon stdout — this daemon is the sidecar for
 *     operators who want a background process logging to .planning/.
 *
 *   gad cross-project list [--json] [--match-all]
 *     One-shot scan. Returns new (unseen) handoffs. --match-all ignores
 *     presence filter and returns all open handoffs across roots.
 *
 * GLOBAL-D-323 Phase D.
 */

const { defineCommand } = require('citty');
const fs   = require('fs');
const path = require('path');
const { tickOnce } = require('../../lib/cross-project-watcher.cjs');

// ---------------------------------------------------------------------------
// Helpers (self-contained — no injected deps needed)
// ---------------------------------------------------------------------------

function findRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (fs.existsSync(path.join(dir, 'gad-config.toml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

/**
 * Minimal TOML parser for [[planning.roots]] blocks.
 * Extracts array of { id, path } from gad-config.toml.
 * Full TOML parsing is not needed — we only care about roots.
 */
function loadPlanningRootsFromConfig(baseDir) {
  const configPath = path.join(baseDir, 'gad-config.toml');
  if (!fs.existsSync(configPath)) return null;
  let text;
  try { text = fs.readFileSync(configPath, 'utf8'); } catch { return null; }

  const roots = [];
  // Match all [[planning.roots]] blocks
  const blockRe = /\[\[planning\.roots\]\]([\s\S]*?)(?=\[\[|\Z|$)/g;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const block = m[1];
    const idMatch   = block.match(/^id\s*=\s*"([^"]+)"/m);
    const pathMatch = block.match(/^path\s*=\s*"([^"]+)"/m);
    if (idMatch && pathMatch) {
      roots.push({ id: idMatch[1], path: pathMatch[1] });
    }
  }
  return roots.length > 0 ? { roots } : null;
}

function pidfilePath(baseDir) {
  return path.join(baseDir, '.planning', 'cross-project-watcher.pid');
}

function writePidfile(baseDir) {
  const p = pidfilePath(baseDir);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, String(process.pid), 'utf8');
  } catch {}
}

function removePidfile(baseDir) {
  try { fs.unlinkSync(pidfilePath(baseDir)); } catch {}
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const watchCmd = defineCommand({
  meta: {
    name:        'watch',
    description: 'Long-running daemon: polls planning roots every N seconds for new cross-project handoffs.',
  },
  args: {
    daemon:       { type: 'boolean', default: false, description: 'Run as daemon (keep looping)' },
    'tick-seconds': { type: 'string',  default: '30',  description: 'Poll interval in seconds' },
  },
  async run({ args }) {
    const baseDir    = findRepoRoot();
    const tickSec    = Math.max(5, parseInt(args['tick-seconds'] || '30', 10) || 30);
    const isDaemon   = args.daemon || false;

    const config     = loadPlanningRootsFromConfig(baseDir);

    if (isDaemon) {
      writePidfile(baseDir);
      process.on('SIGTERM', () => { removePidfile(baseDir); process.exit(0); });
      process.on('SIGINT',  () => { removePidfile(baseDir); process.exit(0); });
    }

    const runTick = () => {
      try {
        const { newHandoffs } = tickOnce({ baseDir, config });
        for (const h of newHandoffs) {
          // Structured line so callers can parse: prefix TAG + JSON
          const line = JSON.stringify({
            tag:          'cross-project-handoff',
            id:           h.id,
            from_project: h.from_project,
            recipient:    h.recipient,
            body_first:   h.body_first,
            ts:           new Date().toISOString(),
          });
          process.stdout.write(line + '\n');
        }
      } catch (err) {
        process.stderr.write(`[cross-project-watcher] tick error: ${err.message}\n`);
      }
    };

    // Always run one tick immediately
    runTick();

    if (!isDaemon) return;

    // Daemon loop
    const interval = setInterval(runTick, tickSec * 1000);
    // Keep process alive
    interval.unref();
    // Re-ref so the process doesn't exit
    interval.ref();

    // On Windows there is no SIGTERM from 'node' by default — also handle
    // graceful shutdown via process.on('exit').
    process.on('exit', () => removePidfile(baseDir));
    // Park the process until killed
    await new Promise(() => {}); // infinite wait
  },
});

const listCmd = defineCommand({
  meta: {
    name:        'list',
    description: 'One-shot scan: print new (unseen) cross-project handoffs.',
  },
  args: {
    json:      { type: 'boolean', default: false, description: 'Output JSON array' },
    'match-all': { type: 'boolean', default: false, description: 'Ignore presence filter; return all open handoffs across roots' },
  },
  run({ args }) {
    const baseDir  = findRepoRoot();
    const config   = loadPlanningRootsFromConfig(baseDir);
    const matchAll = args['match-all'] || false;

    const { newHandoffs, seenCount } = tickOnce({ baseDir, config, matchAll });

    if (args.json) {
      console.log(JSON.stringify({ newHandoffs, seenCount }, null, 2));
      return;
    }

    if (newHandoffs.length === 0) {
      console.log('[cross-project] No new handoffs.');
      return;
    }
    console.log(`[cross-project] ${newHandoffs.length} new handoff(s):`);
    for (const h of newHandoffs) {
      console.log(`  ${h.id}  from=${h.from_project}  recipient=${h.recipient}`);
      if (h.body_first) console.log(`    ${h.body_first}`);
    }
  },
});

const crossProjectCmd = defineCommand({
  meta: {
    name:        'cross-project',
    description: 'Cross-project handoff watcher + listing (GLOBAL-D-323 Phase D).',
  },
  subCommands: {
    watch: watchCmd,
    list:  listCmd,
  },
});

// ---------------------------------------------------------------------------
// Loader contract
// ---------------------------------------------------------------------------

function register() {
  return { 'cross-project': crossProjectCmd };
}

module.exports = crossProjectCmd;
module.exports.register = register;
