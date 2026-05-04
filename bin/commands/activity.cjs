'use strict';
/**
 * gad activity — merged live view across worker, CLI, and trace logs.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

const SOURCE_COLORS = {
  worker: '\x1b[36m',
  cli: '\x1b[33m',
  trace: '\x1b[35m',
};
const ANSI_RESET = '\x1b[0m';
const useAnsi = Boolean(process.stdout && process.stdout.isTTY);

function colorize(source, text) {
  if (!useAnsi) return text;
  const color = SOURCE_COLORS[source] || '';
  return color ? `${color}${text}${ANSI_RESET}` : text;
}

function formatCell(value, width) {
  return String(value == null ? '' : value).padEnd(width).slice(0, width);
}

function formatTs(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return String(ts).slice(0, 19);
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function truncateText(value, max = 90) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function readJsonl(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function summarizeWorkerEvent(entry) {
  return truncateText(
    entry.error
      || entry.ref
      || entry.prompt_file
      || entry.runtime_cmd
      || entry.data
      || '',
  );
}

function summarizeCliEvent(entry) {
  return truncateText(
    entry.cmd
      || entry.gad_command
      || entry.input_summary
      || entry.tool
      || entry.type
      || '',
  );
}

function summarizeTraceEvent(entry) {
  return truncateText(
    (entry.inputs && (entry.inputs.command || entry.inputs.file_path))
      || entry.tool
      || entry.type
      || entry.outputs
      || '',
  );
}

function normalizeWorkerEvent(entry, filePath) {
  const workerId = entry.worker_id || path.basename(path.dirname(path.dirname(filePath))) || 'worker';
  return {
    ts: entry.ts || null,
    source: 'worker',
    actor: workerId,
    kind: entry.kind || 'event',
    detail: summarizeWorkerEvent(entry),
    filePath,
  };
}

function normalizeCliEvent(entry, filePath) {
  const runtimeId = (entry.runtime && entry.runtime.id) || entry.tool || entry.type || 'gad';
  const kind = entry.cmd ? String(entry.cmd).split(/\s+/).slice(0, 2).join(' ') : (entry.type || 'event');
  return {
    ts: entry.ts || null,
    source: 'cli',
    actor: runtimeId,
    kind,
    detail: summarizeCliEvent(entry),
    filePath,
  };
}

function normalizeTraceEvent(entry, filePath) {
  const runtimeId = (entry.runtime && entry.runtime.id) || (entry.agent && entry.agent.agent_id) || 'trace';
  return {
    ts: entry.ts || null,
    source: 'trace',
    actor: runtimeId,
    kind: entry.tool || entry.type || 'event',
    detail: summarizeTraceEvent(entry),
    filePath,
  };
}

function buildSourceFiles(baseDir) {
  const planningDir = path.join(baseDir, '.planning');
  const workerRoot = path.join(planningDir, 'team', 'workers');
  const workerFiles = [];
  if (fs.existsSync(workerRoot)) {
    for (const entry of fs.readdirSync(workerRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const logPath = path.join(workerRoot, entry.name, 'log.jsonl');
      if (fs.existsSync(logPath)) workerFiles.push(logPath);
    }
  }

  const cliRoot = path.join(planningDir, '.gad-log');
  const cliFiles = fs.existsSync(cliRoot)
    ? fs.readdirSync(cliRoot)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => path.join(cliRoot, name))
    : [];

  const traceFile = path.join(planningDir, '.trace-events.jsonl');
  const traceFiles = fs.existsSync(traceFile) ? [traceFile] : [];

  return { planningDir, workerRoot, cliRoot, workerFiles, cliFiles, traceFiles };
}

function collectEvents(baseDir) {
  const files = buildSourceFiles(baseDir);
  const events = [];
  for (const workerFile of files.workerFiles) {
    for (const entry of readJsonl(workerFile)) events.push(normalizeWorkerEvent(entry, workerFile));
  }
  for (const cliFile of files.cliFiles) {
    for (const entry of readJsonl(cliFile)) events.push(normalizeCliEvent(entry, cliFile));
  }
  for (const traceFile of files.traceFiles) {
    for (const entry of readJsonl(traceFile)) events.push(normalizeTraceEvent(entry, traceFile));
  }
  return { files, events };
}

function printHeader() {
  const header = [
    formatCell('TIME', 19),
    formatCell('SOURCE', 8),
    formatCell('ACTOR', 14),
    formatCell('KIND', 18),
    'DETAIL',
  ].join('  ');
  const sep = ['-'.repeat(19), '-'.repeat(8), '-'.repeat(14), '-'.repeat(18), '-'.repeat(80)].join('  ');
  console.log(header);
  console.log(sep);
}

function printEvent(event) {
  const sourceLabel = colorize(event.source, formatCell(event.source, 8));
  const line = [
    formatCell(formatTs(event.ts), 19),
    sourceLabel,
    formatCell(event.actor || '', 14),
    formatCell(event.kind || '', 18),
    truncateText(event.detail || '', 120),
  ].join('  ');
  console.log(line);
}

function filterAndSortEvents(events, sinceIso, limit) {
  const sinceMs = sinceIso ? Date.parse(String(sinceIso)) : null;
  const filtered = events.filter((event) => {
    if (!event.ts) return false;
    const eventMs = Date.parse(String(event.ts));
    if (Number.isNaN(eventMs)) return false;
    if (sinceMs != null && !Number.isNaN(sinceMs) && eventMs < sinceMs) return false;
    return true;
  });
  filtered.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  if (limit > 0 && filtered.length > limit) return filtered.slice(-limit);
  return filtered;
}

function createFileFollower({ normalize, onEvent }) {
  const positions = new Map();
  const watchers = new Map();

  function prime(filePath) {
    try {
      positions.set(filePath, fs.statSync(filePath).size);
    } catch {}
  }

  function readNew(filePath) {
    if (!fs.existsSync(filePath)) return;
    let start = positions.get(filePath) || 0;
    const stat = fs.statSync(filePath);
    if (stat.size < start) start = 0;
    if (stat.size === start) return;
    const fd = fs.openSync(filePath, 'r');
    try {
      const chunk = Buffer.alloc(stat.size - start);
      fs.readSync(fd, chunk, 0, chunk.length, start);
      positions.set(filePath, stat.size);
      for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) {
        try {
          const parsed = JSON.parse(line);
          const normalized = normalize(parsed, filePath);
          if (normalized && normalized.ts) onEvent(normalized);
        } catch {}
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  function watchFile(filePath) {
    if (watchers.has(filePath) || !fs.existsSync(filePath)) return;
    prime(filePath);
    const watcher = fs.watch(filePath, { persistent: true }, () => {
      try { readNew(filePath); } catch {}
    });
    watchers.set(filePath, watcher);
  }

  function closeAll() {
    for (const watcher of watchers.values()) {
      try { watcher.close(); } catch {}
    }
    watchers.clear();
  }

  return { prime, watchFile, closeAll };
}

function createActivityCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveProjectBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return repoRoot;
    return path.join(repoRoot, root.path);
  }

  return defineCommand({
    meta: { name: 'activity', description: 'Merged live activity stream across worker logs, gad CLI logs, and trace events.' },
    args: {
      projectid: { type: 'string', description: 'Target project id', default: '' },
      since: { type: 'string', description: 'Only show events at or after this ISO timestamp', default: '' },
      limit: { type: 'string', description: 'Initial event cap when printing existing history (default 100)', default: '100' },
      once: { type: 'boolean', description: 'Print current matching events and exit (test/debug helper)', default: false },
    },
    async run({ args }) {
      const baseDir = resolveProjectBaseDir(args);
      if (!fs.existsSync(path.join(baseDir, '.planning'))) {
        outputError(`No .planning directory under ${baseDir}`);
        process.exit(1);
      }
      const sinceIso = String(args.since || '').trim();
      if (sinceIso && Number.isNaN(Date.parse(sinceIso))) {
        outputError(`Invalid --since ISO timestamp: ${sinceIso}`);
        process.exit(1);
      }

      const limit = Math.max(0, Number.parseInt(String(args.limit), 10) || 100);
      const initial = collectEvents(baseDir);
      const initialEvents = filterAndSortEvents(initial.events, sinceIso, limit);

      printHeader();
      for (const event of initialEvents) printEvent(event);
      if (args.once) return;

      const seen = new Set(initialEvents.map((event) => `${event.source}|${event.filePath}|${event.ts}|${event.kind}|${event.detail}`));
      const emitEvent = (event) => {
        const key = `${event.source}|${event.filePath}|${event.ts}|${event.kind}|${event.detail}`;
        if (seen.has(key)) return;
        if (sinceIso && Date.parse(String(event.ts)) < Date.parse(sinceIso)) return;
        seen.add(key);
        printEvent(event);
      };

      const workerFollower = createFileFollower({ normalize: normalizeWorkerEvent, onEvent: emitEvent });
      const cliFollower = createFileFollower({ normalize: normalizeCliEvent, onEvent: emitEvent });
      const traceFollower = createFileFollower({ normalize: normalizeTraceEvent, onEvent: emitEvent });

      const directoryWatchers = [];
      const refreshFiles = () => {
        const files = buildSourceFiles(baseDir);
        for (const file of files.workerFiles) workerFollower.watchFile(file);
        for (const file of files.cliFiles) cliFollower.watchFile(file);
        for (const file of files.traceFiles) traceFollower.watchFile(file);
      };
      refreshFiles();

      const registerDirWatcher = (target, handler) => {
        if (!target || !fs.existsSync(target)) return;
        try {
          directoryWatchers.push(fs.watch(target, { persistent: true }, handler));
        } catch {}
      };
      registerDirWatcher(path.join(baseDir, '.planning', 'team', 'workers'), refreshFiles);
      registerDirWatcher(path.join(baseDir, '.planning', '.gad-log'), refreshFiles);
      registerDirWatcher(path.join(baseDir, '.planning'), (eventType, filename) => {
        if (!filename || String(filename).includes('.trace-events.jsonl')) refreshFiles();
      });

      await new Promise((resolve) => {
        const cleanup = () => {
          workerFollower.closeAll();
          cliFollower.closeAll();
          traceFollower.closeAll();
          for (const watcher of directoryWatchers) {
            try { watcher.close(); } catch {}
          }
          process.off('SIGINT', cleanup);
          resolve();
        };
        process.on('SIGINT', cleanup);
      });
    },
  });
}

module.exports = { createActivityCommand };
module.exports.register = (ctx) => ({ activity: createActivityCommand(ctx.common) });
