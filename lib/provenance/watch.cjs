'use strict';
/**
 * lib/provenance/watch.cjs — file watcher daemon.
 *
 * Reactive layer on top of the trace-archive: when a file under a planning
 * root changes (any agent, including raw IDE edits that don't go through
 * Claude tool calls), capture a synthetic provenance event.
 *
 * Uses Node's built-in fs.watch (no chokidar dep). Recursive watching is
 * native on Windows/macOS, requires per-dir on Linux — we walk and watch
 * each directory there. Debounces to coalesce burst edits (IDE saves can
 * fire multiple events per save).
 *
 * Per decision GLOBAL-D-300: events go to .planning/.provenance/<date>.jsonl
 * with kind "fs_change", source="watcher". The joiner cross-references
 * with active handoffs at that ts so attribution still works.
 */

const fs = require('node:fs');
const path = require('node:path');
const { ymd, provenanceFilePath, ensureProvenanceDir } = require('./index.cjs');
const { parseHandoffFrontmatter } = require('./join.cjs');

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_IGNORE = [
  /[/\\]node_modules[/\\]/,
  /[/\\]\.git[/\\]/,
  /[/\\]\.next[/\\]/,
  /[/\\]\.turbo[/\\]/,
  /[/\\]dist[/\\]/,
  /[/\\]build[/\\]/,
  /[/\\]\.cache[/\\]/,
  /[/\\]\.planning[/\\]\.trace-events\.jsonl$/,
  /[/\\]\.planning[/\\]\.trace-archive[/\\]/,
  /[/\\]\.planning[/\\]\.provenance[/\\]/,
  /[/\\]\.planning[/\\]\.gad-log[/\\]/,
  /[/\\]\.planning[/\\]team[/\\]/,
  /[/\\]\.planning[/\\]sessions[/\\]/,
  /[/\\]\.planning[/\\]graph\.(json|html)$/,
  /\.tmp$/,
  /~$/,
  /\.swp$/,
  /\.swo$/,
];

function shouldIgnore(filePath) {
  return DEFAULT_IGNORE.some((re) => re.test(filePath));
}

function loadActiveHandoffs(planningDir) {
  const result = [];
  for (const sub of ['open', 'claimed']) {
    const dir = path.join(planningDir, 'handoffs', sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const fm = parseHandoffFrontmatter(path.join(dir, f));
      if (fm) result.push(fm);
    }
  }
  return result;
}

function attributionForTs(handoffs, tsIso) {
  const tsMs = new Date(tsIso).getTime();
  const candidates = handoffs.filter((h) => {
    if (!h.claimed_at) return false;
    const claimMs = new Date(h.claimed_at).getTime();
    if (tsMs < claimMs) return false;
    const endMs = h.completed_at ? new Date(h.completed_at).getTime() : Date.now() + 3600_000;
    if (tsMs > endMs) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  // Narrowest active window first
  candidates.sort((a, b) => {
    const aw = (new Date(a.completed_at || Date.now()).getTime() - new Date(a.claimed_at).getTime());
    const bw = (new Date(b.completed_at || Date.now()).getTime() - new Date(b.claimed_at).getTime());
    return aw - bw;
  });
  return candidates[0];
}

function watchDir(rootPath, onEvent) {
  // Try recursive (works on Win/macOS); fall back to per-dir walk on Linux.
  try {
    const watcher = fs.watch(rootPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const fullPath = path.join(rootPath, filename);
      if (shouldIgnore(fullPath)) return;
      onEvent({ eventType, fullPath });
    });
    return [watcher];
  } catch (e) {
    // Linux: no recursive support — walk and watch each dir
    const watchers = [];
    function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      try {
        watchers.push(fs.watch(dir, (eventType, filename) => {
          if (!filename) return;
          const fullPath = path.join(dir, filename);
          if (shouldIgnore(fullPath)) return;
          onEvent({ eventType, fullPath });
        }));
      } catch {}
      for (const ent of entries) {
        if (ent.isDirectory() && !shouldIgnore(path.join(dir, ent.name))) {
          walk(path.join(dir, ent.name));
        }
      }
    }
    walk(rootPath);
    return watchers;
  }
}

/**
 * Start a long-running watcher. Returns { stop: () => void }.
 */
function startWatching({ planningDir, rootPath, debounceMs = DEFAULT_DEBOUNCE_MS, onEmit }) {
  ensureProvenanceDir(planningDir);
  const handoffs = loadActiveHandoffs(planningDir);
  // Reload handoffs every 60s in case they change mid-watch
  let handoffsCache = handoffs;
  const reloadInterval = setInterval(() => {
    try { handoffsCache = loadActiveHandoffs(planningDir); } catch {}
  }, 60_000);

  const debounceMap = new Map();  // filePath -> { firstTs, eventTypes: Set, timer }

  function emit(filePath, info) {
    const ts = new Date(info.firstTs).toISOString();
    const handoff = attributionForTs(handoffsCache, ts);
    let stat = null;
    try { stat = fs.statSync(filePath); } catch {}
    const enriched = {
      event_id: `watch-${path.basename(filePath)}-${info.firstTs}`,
      ts,
      tool: 'fs_change',
      file_path: filePath,
      diff: {
        kind: 'fs_change',
        event_types: Array.from(info.eventTypes),
        size_bytes: stat ? stat.size : null,
        mtime: stat ? stat.mtime.toISOString() : null,
      },
      runtime: {
        id: 'watcher',
        model_id: null,
        session_id: null,
        source: 'fs.watch',
        soul: 'conan',
      },
      agent: { id: 'conan', role: 'watcher', parent: null, root: null, depth: null, model_profile: null, resolved_model: null },
      handoff: handoff ? {
        id: handoff.id || null,
        projectid: handoff.projectid || null,
        phase: handoff.phase || null,
        task_id: handoff.task_id || null,
        claimed_by: handoff.claimed_by || null,
      } : null,
      task: null,
      project: null,
    };
    const outPath = provenanceFilePath(planningDir, ymd(new Date(ts)));
    fs.appendFileSync(outPath, JSON.stringify(enriched) + '\n', 'utf8');
    if (onEmit) onEmit(enriched);
  }

  const watchers = watchDir(rootPath, ({ eventType, fullPath }) => {
    if (!debounceMap.has(fullPath)) {
      debounceMap.set(fullPath, {
        firstTs: Date.now(),
        eventTypes: new Set([eventType]),
        timer: null,
      });
    }
    const info = debounceMap.get(fullPath);
    info.eventTypes.add(eventType);
    if (info.timer) clearTimeout(info.timer);
    info.timer = setTimeout(() => {
      emit(fullPath, info);
      debounceMap.delete(fullPath);
    }, debounceMs);
  });

  return {
    stop: () => {
      clearInterval(reloadInterval);
      for (const w of watchers) {
        try { w.close(); } catch {}
      }
      for (const [, info] of debounceMap.entries()) {
        if (info.timer) clearTimeout(info.timer);
      }
    },
    watcherCount: watchers.length,
  };
}

module.exports = { startWatching };
