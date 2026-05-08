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
 *   gad sessions watch   [--projectid X] [--once] [--daemon] [--interval-sec N] [--json]
 *
 * Auto-loaded by bin/commands/_loader.cjs — no edits to bin/gad.cjs required.
 * Module exports: { register }
 */

const fs = require('fs');
const os = require('os');
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

// ── watch ─────────────────────────────────────────────────────────────────────

/**
 * Discover Claude Code transcript JSONL files.
 * Checks:
 *   - $CLAUDE_HOME/projects/<slug>/*.jsonl
 *   - %APPDATA%/Roaming/claude-code/projects/<slug>/*.jsonl  (Windows)
 *   - ~/.claude/projects/<slug>/*.jsonl                      (Linux/macOS)
 *   - .planning/.sessions/<id>/events.jsonl                  (raw emit from hook)
 */
function discoverTranscriptFiles(projectRoot) {
  const results = [];

  // Derive repo slug from projectRoot (last two path components joined with -)
  const parts = projectRoot.replace(/\\/g, '/').split('/').filter(Boolean);
  const slugRaw = parts.slice(-2).join('-').replace(/[^a-zA-Z0-9_-]/g, '-');

  const candidateDirs = [];

  // $CLAUDE_HOME override
  if (process.env.CLAUDE_HOME) {
    candidateDirs.push(path.join(process.env.CLAUDE_HOME, 'projects', slugRaw));
  }

  // Windows: %APPDATA%\claude-code\projects\<slug>
  if (process.env.APPDATA) {
    candidateDirs.push(path.join(process.env.APPDATA, 'claude-code', 'projects', slugRaw));
    // Also try Roaming explicitly
    candidateDirs.push(path.join(process.env.APPDATA, 'Roaming', 'claude-code', 'projects', slugRaw));
  }

  // Windows: %LOCALAPPDATA%\claude-code\projects\<slug>
  if (process.env.LOCALAPPDATA) {
    candidateDirs.push(path.join(process.env.LOCALAPPDATA, 'claude-code', 'projects', slugRaw));
  }

  // Linux / macOS: ~/.claude/projects/<slug>
  try {
    candidateDirs.push(path.join(os.homedir(), '.claude', 'projects', slugRaw));
  } catch {}

  // Also check exact slug from APPDATA path (claude stores as encoded path)
  // %APPDATA%\Claude\projects\<url-encoded-path>\*.jsonl
  if (process.env.APPDATA) {
    const claudeDir = path.join(process.env.APPDATA, 'Claude', 'projects');
    if (fs.existsSync(claudeDir)) {
      try {
        for (const sub of fs.readdirSync(claudeDir)) {
          const decoded = decodeURIComponent(sub.replace(/-/g, '%'));
          if (decoded.includes(parts[parts.length - 1])) {
            candidateDirs.push(path.join(claudeDir, sub));
          }
        }
      } catch {}
    }
  }

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
      for (const f of files) {
        results.push(path.join(dir, f));
      }
    } catch {}
  }

  // Also pick up raw .planning/.sessions/<id>/events.jsonl files
  const rawSessionsDir = path.join(projectRoot, '.planning', '.sessions');
  if (fs.existsSync(rawSessionsDir)) {
    try {
      for (const sessionDir of fs.readdirSync(rawSessionsDir)) {
        const eventsFile = path.join(rawSessionsDir, sessionDir, 'events.jsonl');
        if (fs.existsSync(eventsFile)) results.push(eventsFile);
      }
    } catch {}
  }

  // Deduplicate
  return [...new Set(results)];
}

/**
 * Parse lines from a transcript file (claude-code format or raw emit format).
 * Returns array of parsed objects (skips unparseable lines).
 */
function parseTranscriptLines(content) {
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

/**
 * Infer a session id from a transcript file path.
 * E.g. <dir>/<sessionId>.jsonl or .sessions/<sessionId>/events.jsonl
 */
function inferSessionId(filePath) {
  const basename = path.basename(filePath, '.jsonl');
  if (basename === 'events') {
    // .sessions/<sessionId>/events.jsonl
    return path.basename(path.dirname(filePath));
  }
  return basename || 'unknown';
}

/**
 * Process a single transcript file: read new lines since lastSize, adapt + append.
 * Returns { newEvents, errors }.
 */
function processTranscriptFile(filePath, mtimeCache, { appendTelemetryEvent, adaptClaudeCodeEmit, projectRoot }) {
  let newEvents = 0;
  let errors = 0;

  let stat;
  try { stat = fs.statSync(filePath); } catch { return { newEvents, errors }; }

  const cacheKey = filePath;
  const cached = mtimeCache.get(cacheKey) || { mtime: 0, size: 0 };

  // Skip if unchanged
  if (stat.mtimeMs <= cached.mtime && stat.size === cached.size) {
    return { newEvents, errors };
  }

  let content = '';
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return { newEvents, errors }; }

  // Only process new bytes since last read
  const lastSize = cached.size;
  const newContent = stat.size > lastSize
    ? content.slice(lastSize)
    : content; // file truncated or first read — process all

  mtimeCache.set(cacheKey, { mtime: stat.mtimeMs, size: stat.size });

  const lines = parseTranscriptLines(newContent);
  const sessionId = inferSessionId(filePath);

  for (const raw of lines) {
    // Ensure session_id is populated (transcript files may omit it)
    if (!raw.session_id) raw.session_id = sessionId;

    try {
      const records = adaptClaudeCodeEmit(raw);
      for (const rec of records) {
        try {
          appendTelemetryEvent({ ...rec, projectRoot });
          newEvents += 1;
        } catch { errors += 1; }
      }
    } catch { errors += 1; }
  }

  return { newEvents, errors };
}

/**
 * One scan pass: discover files, process new lines, return summary.
 */
function scanOnce(projectRoot, mtimeCache, telemetry) {
  const files = discoverTranscriptFiles(projectRoot);
  let totalNew = 0;
  let totalErrors = 0;

  for (const f of files) {
    const { newEvents, errors } = processTranscriptFile(f, mtimeCache, { ...telemetry, projectRoot });
    totalNew += newEvents;
    totalErrors += errors;
  }

  return { files_scanned: files.length, new_events: totalNew, errors: totalErrors };
}

/**
 * Hardened daemon loop (--daemon mode).
 * - Pidfile at .planning/sessions-watcher.pid
 * - Log at .planning/sessions-watcher.log
 * - In-flight guard (no overlapping ticks)
 * - Graceful SIGTERM/SIGINT
 */
async function runDaemon({ projectRoot, intervalSec, telemetry, log }) {
  const pidFile = path.join(projectRoot, '.planning', 'sessions-watcher.pid');
  const logFile = path.join(projectRoot, '.planning', 'sessions-watcher.log');

  // Write pidfile
  try { fs.writeFileSync(pidFile, String(process.pid), 'utf8'); } catch {}

  function appendLog(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(logFile, line, 'utf8'); } catch {}
    log(msg);
  }

  appendLog(`sessions-watcher daemon started pid=${process.pid} interval=${intervalSec}s`);

  let running = true;
  let ticking = false;
  const mtimeCache = new Map();

  process.on('SIGTERM', () => { appendLog('SIGTERM received — shutting down'); running = false; });
  process.on('SIGINT',  () => { appendLog('SIGINT received — shutting down');  running = false; });

  while (running) {
    if (!ticking) {
      ticking = true;
      try {
        const result = scanOnce(projectRoot, mtimeCache, telemetry);
        if (result.new_events > 0 || result.errors > 0) {
          appendLog(`tick: files=${result.files_scanned} new_events=${result.new_events} errors=${result.errors}`);
        }
      } catch (e) {
        appendLog(`tick error: ${e.message}`);
      } finally {
        ticking = false;
      }
    }

    if (!running) break;

    // Sleep intervalSec in 1-second increments so SIGTERM is responsive
    for (let i = 0; i < intervalSec && running; i++) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  try { fs.unlinkSync(pidFile); } catch {}
  appendLog('sessions-watcher daemon stopped');
}

const sessionsWatchCmd = defineCommand({
  meta: { name: 'watch', description: 'Watch Claude Code transcript files and append new events to session telemetry' },
  args: {
    projectid: { type: 'string', description: 'Project id (used for root resolution)', default: '' },
    once:        { type: 'boolean', description: 'Run one scan pass and exit', default: false },
    daemon:      { type: 'boolean', description: 'Run in hardened daemon mode (pidfile + logfile)', default: false },
    'interval-sec': { type: 'string', description: 'Poll interval in seconds (daemon mode, default 30)', default: '30' },
    json:        { type: 'boolean', description: 'JSON output for --once mode', default: false },
  },
  async run({ args }) {
    const root = findProjectRoot(process.cwd());
    if (!root) {
      process.stderr.write('gad sessions watch: cannot locate project root (no .planning/ directory)\n');
      process.exit(1);
      return;
    }

    // Load telemetry substrate
    let appendTelemetryEventFn;
    let adaptClaudeCodeEmitFn;
    try {
      const telIdx = require('../../lib/session-telemetry/index.cjs');
      const telAdp = require('../../lib/session-telemetry/adapters/claude-code.cjs');
      appendTelemetryEventFn = telIdx.appendTelemetryEvent;
      adaptClaudeCodeEmitFn  = telAdp.adaptClaudeCodeEmit;
    } catch (e) {
      process.stderr.write(`gad sessions watch: failed to load telemetry substrate: ${e.message}\n`);
      process.exit(1);
      return;
    }

    const telemetry = {
      appendTelemetryEvent: appendTelemetryEventFn,
      adaptClaudeCodeEmit:  adaptClaudeCodeEmitFn,
    };

    const intervalSec = Math.max(1, parseInt(args['interval-sec'] || '30', 10) || 30);

    // --once: single scan pass
    if (args.once || (!args.daemon && !args.once)) {
      // Default (no flags) also does a single scan for smoke-test ergonomics.
      // If --daemon is set without --once we skip straight to daemon loop.
      if (!args.daemon) {
        const mtimeCache = new Map();
        const result = scanOnce(root, mtimeCache, telemetry);
        if (args.json) {
          console.log(JSON.stringify(result));
        } else {
          console.log(`files_scanned : ${result.files_scanned}`);
          console.log(`new_events    : ${result.new_events}`);
          console.log(`errors        : ${result.errors}`);
        }
        return;
      }
    }

    // --daemon: hardened loop
    await runDaemon({
      projectRoot: root,
      intervalSec,
      telemetry,
      log: (msg) => { if (!args.json) console.log(msg); },
    });
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
    watch: sessionsWatchCmd,
  },
});

// ── loader contract ───────────────────────────────────────────────────────────

function register(_ctx) {
  return { sessions: sessionsCmd };
}

module.exports = { register };
