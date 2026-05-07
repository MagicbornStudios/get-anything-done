'use strict';
/**
 * gad transcripts — list / show / export subcommands.
 *
 * Phase 169-01: Kael chat transcript logging.
 * Reads from .planning/transcripts/<YYYY-MM-DD>/<thread_id>.jsonl
 * (written by apps/desktop Tauri sidecar gad_transcript_append command).
 *
 * Auto-discovered by bin/commands/_loader.cjs — no edits to bin/gad.cjs needed.
 *
 * Required deps (from common bag):
 *   findRepoRoot, outputError, render, shouldUseJson
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { defineCommand } = require('citty');

/**
 * Locate the transcripts root directory.
 * Prefers <repo-root>/.planning/transcripts/
 * Falls back to ~/.gad/transcripts/ when no monorepo is found.
 */
function resolveTranscriptsRoot(findRepoRoot) {
  try {
    const repoRoot = findRepoRoot();
    return path.join(repoRoot, '.planning', 'transcripts');
  } catch (_) {
    return path.join(os.homedir(), '.gad', 'transcripts');
  }
}

/**
 * List all date-dirs >= since (YYYY-MM-DD string or falsy).
 * Returns [{ date, dir }] sorted ascending.
 */
function listDateDirs(transcriptsRoot, since) {
  if (!fs.existsSync(transcriptsRoot)) return [];
  return fs
    .readdirSync(transcriptsRoot)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && (!since || d >= since))
    .sort()
    .map((d) => ({ date: d, dir: path.join(transcriptsRoot, d) }));
}

/**
 * Count lines in a JSONL file (each line is one message).
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').filter((l) => l.trim()).length;
  } catch (_) {
    return 0;
  }
}

/**
 * Read all lines from a JSONL file as parsed objects (skip blank/malformed).
 */
function readJsonl(filePath) {
  try {
    return fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try { return JSON.parse(l); } catch (_) { return null; }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Truncate a string to maxLen chars with ellipsis.
 */
function trunc(s, maxLen) {
  if (!s || s.length <= maxLen) return s || '';
  return s.slice(0, maxLen - 1) + '…';
}

/**
 * Format a message entry for pretty-printing.
 * --full: full content; default: truncate at 200 chars.
 */
function formatEntry(entry, full) {
  const role = String(entry.role || 'unknown').toUpperCase().padEnd(9);
  const msgId = String(entry.msg_id || '').slice(0, 16);
  const ts = entry.ts
    ? new Date(Number(entry.ts)).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')
    : '—';

  const textContent = Array.isArray(entry.content_parts)
    ? entry.content_parts
        .filter((p) => p && p.type === 'text')
        .map((p) => String(p.text || ''))
        .join(' ')
    : '';

  const toolInfo = Array.isArray(entry.tool_calls) && entry.tool_calls.length > 0
    ? `[tools: ${entry.tool_calls.map((t) => t.toolName).join(', ')}]`
    : '';

  const displayText = full ? textContent : trunc(textContent, 200);
  const parts = [ts, role, `msg:${msgId}`];
  if (toolInfo) parts.push(toolInfo);
  if (displayText) parts.push(displayText);
  return parts.join('  ');
}

function createTranscriptsCommand(deps) {
  const { findRepoRoot, outputError } = deps;

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List transcript files under .planning/transcripts/, grouped by date' },
    args: {
      since: { type: 'string', description: 'Only show dates >= YYYY-MM-DD', default: '' },
      projectid: { type: 'string', description: 'Unused — transcripts are repo-scoped, not project-scoped', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const transcriptsRoot = resolveTranscriptsRoot(findRepoRoot);
      const since = String(args.since || '');
      const dateDirs = listDateDirs(transcriptsRoot, since);

      const entries = [];
      for (const { date, dir } of dateDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
        for (const file of files) {
          const threadId = file.replace(/\.jsonl$/, '');
          const filePath = path.join(dir, file);
          entries.push({
            date,
            thread_id: threadId,
            file: filePath,
            messages: countLines(filePath),
          });
        }
      }

      if (args.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log('No transcripts found.');
        return;
      }

      // Group by date for human output.
      const byDate = {};
      for (const e of entries) {
        if (!byDate[e.date]) byDate[e.date] = [];
        byDate[e.date].push(e);
      }
      for (const [date, group] of Object.entries(byDate)) {
        console.log(`\n── ${date} ──────────────────────────────`);
        for (const e of group) {
          console.log(`  thread: ${e.thread_id}  messages: ${e.messages}`);
        }
      }
    },
  });

  // ---------------------------------------------------------------------------
  // show
  // ---------------------------------------------------------------------------
  const showCmd = defineCommand({
    meta: { name: 'show', description: 'Pretty-print a thread\'s messages' },
    args: {
      thread_id: { type: 'positional', description: 'Thread UUID (or partial prefix)', required: true },
      date: { type: 'string', description: 'Date YYYY-MM-DD to scope search (optional)', default: '' },
      full: { type: 'boolean', description: 'Show full message content (not truncated)', default: false },
    },
    run({ args }) {
      const transcriptsRoot = resolveTranscriptsRoot(findRepoRoot);
      const threadIdQuery = String(args.thread_id);
      const dateFilter = String(args.date || '');
      const full = Boolean(args.full);

      // Search for matching file(s).
      const dateDirs = listDateDirs(transcriptsRoot, dateFilter || undefined);
      let found = null;

      for (const { dir } of dateDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
        for (const file of files) {
          const threadId = file.replace(/\.jsonl$/, '');
          if (threadId === threadIdQuery || threadId.startsWith(threadIdQuery)) {
            found = { filePath: path.join(dir, file), threadId };
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        outputError(`Thread not found: ${threadIdQuery}`);
        process.exit(1);
        return;
      }

      const entries = readJsonl(found.filePath);
      if (entries.length === 0) {
        console.log(`Thread ${found.threadId}: (empty)`);
        return;
      }

      console.log(`\nThread: ${found.threadId}`);
      console.log(`Messages: ${entries.length}`);
      console.log('─'.repeat(72));
      for (const entry of entries) {
        console.log(formatEntry(entry, full));
        if (full) console.log('');
      }
    },
  });

  // ---------------------------------------------------------------------------
  // export
  // ---------------------------------------------------------------------------
  const exportCmd = defineCommand({
    meta: { name: 'export', description: 'Emit a labeled JSONL bundle for training-data pipelines' },
    args: {
      since: { type: 'string', description: 'Only include dates >= YYYY-MM-DD', default: '' },
      label: { type: 'string', description: 'Label tag to attach to each line (e.g. kael-v1)', default: 'kael' },
      out: { type: 'string', description: 'Output file path (default: stdout)', default: '' },
    },
    run({ args }) {
      const transcriptsRoot = resolveTranscriptsRoot(findRepoRoot);
      const since = String(args.since || '');
      const label = String(args.label || 'kael');
      const outFile = String(args.out || '');

      const dateDirs = listDateDirs(transcriptsRoot, since);
      const lines = [];

      for (const { dir } of dateDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
        for (const file of files) {
          const filePath = path.join(dir, file);
          const entries = readJsonl(filePath);
          for (const entry of entries) {
            lines.push(JSON.stringify({ ...entry, _label: label }));
          }
        }
      }

      const output = lines.join('\n') + (lines.length > 0 ? '\n' : '');

      if (outFile) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, output, 'utf8');
        console.log(`Exported ${lines.length} entries to ${outFile}`);
      } else {
        process.stdout.write(output);
      }
    },
  });

  return defineCommand({
    meta: { name: 'transcripts', description: 'Manage Kael chat transcripts (.planning/transcripts/)' },
    subCommands: {
      list: listCmd,
      show: showCmd,
      export: exportCmd,
    },
  });
}

module.exports = { createTranscriptsCommand };
module.exports.register = (ctx) => ({ transcripts: createTranscriptsCommand(ctx.common) });
