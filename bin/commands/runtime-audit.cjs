'use strict';
/**
 * gad runtime audit — cross-runtime spend ledger inspector.
 *
 * Subcommands:
 *   summary  [--days=1]          group ai-spend-ledger rows by runtime+model
 *   codex    [--since=<iso|rel>] list codex invocations since cutoff
 *   unknown                      find trace-events with no ledger match
 *
 * Phase 188-04 (GLOBAL-T-188-04).
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { findRepoRoot } = require('../../lib/spend-ledger.cjs');

// ── helpers ───────────────────────────────────────────────────────────────────

function ledgerDir(root) {
  return path.join(root, '.planning', 'datasets', 'ai-spend-ledger');
}

function traceFile(root) {
  return path.join(root, '.planning', '.trace-events.jsonl');
}

/** Read and parse a .jsonl file. Returns [] on missing / error. */
function readJsonl(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Collect ledger rows for the last N days (today = day 1). */
function collectLedgerRows(root, days) {
  const dir = ledgerDir(root);
  const rows = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
    const f = path.join(dir, `${d}.jsonl`);
    rows.push(...readJsonl(f));
  }
  return rows;
}

/** Parse a --since value: ISO string or relative like "24h", "2d". */
function parseSince(since) {
  if (!since) return new Date(Date.now() - 86400000); // default 24h
  if (/^\d+h$/i.test(since)) return new Date(Date.now() - parseInt(since) * 3600000);
  if (/^\d+d$/i.test(since)) return new Date(Date.now() - parseInt(since) * 86400000);
  const d = new Date(since);
  return isNaN(d.getTime()) ? new Date(Date.now() - 86400000) : d;
}

/** Format a number with null-safe fallback. */
function fmtNum(n) {
  if (n == null) return 'n/a';
  return Number(n).toLocaleString();
}

/** Pad string to width. */
function pad(str, width, right = false) {
  const s = String(str ?? '');
  if (right) return s.padStart(width);
  return s.padEnd(width);
}

// ── summary subcommand ────────────────────────────────────────────────────────

function createSummaryCommand() {
  return defineCommand({
    meta: { name: 'summary', description: 'Summarize ai-spend-ledger rows by runtime + model' },
    args: {
      days: { type: 'string', description: 'Number of days to look back (default: 1)', default: '1' },
    },
    run({ args }) {
      const root = findRepoRoot(process.cwd());
      const days = Math.max(1, parseInt(args.days) || 1);
      const rows = collectLedgerRows(root, days);

      if (rows.length === 0) {
        console.log(`No spend ledger entries found for last ${days} day(s).`);
        console.log(`(expected at ${ledgerDir(root)})`);
        return;
      }

      // Group by runtime + model
      const groups = {};
      for (const row of rows) {
        const key = `${row.runtime || 'unknown'}||${row.model || 'unknown'}`;
        if (!groups[key]) groups[key] = { runtime: row.runtime || 'unknown', model: row.model || 'unknown', calls: 0, prompt_t: 0, completion_t: 0 };
        groups[key].calls++;
        if (row.prompt_tokens != null) groups[key].prompt_t += row.prompt_tokens;
        if (row.completion_tokens != null) groups[key].completion_t += row.completion_tokens;
      }

      const sorted = Object.values(groups).sort((a, b) => b.calls - a.calls);

      const W = { runtime: 14, model: 30, calls: 7, prompt: 12, completion: 12 };
      const header = [
        pad('runtime', W.runtime),
        pad('model', W.model),
        pad('calls', W.calls, true),
        pad('prompt_t', W.prompt, true),
        pad('completion_t', W.completion, true),
      ].join('  ');
      const divider = '-'.repeat(header.length);

      console.log(`\nAI Spend Summary — last ${days} day(s)  (${rows.length} rows)\n`);
      console.log(header);
      console.log(divider);
      for (const g of sorted) {
        console.log([
          pad(g.runtime, W.runtime),
          pad(g.model, W.model),
          pad(g.calls, W.calls, true),
          pad(fmtNum(g.prompt_t || null), W.prompt, true),
          pad(fmtNum(g.completion_t || null), W.completion, true),
        ].join('  '));
      }
      console.log(divider);
    },
  });
}

// ── codex subcommand ─────────────────────────────────────────────────────────

function createCodexCommand() {
  return defineCommand({
    meta: { name: 'codex', description: 'List codex invocations since a cutoff (default: 24h)' },
    args: {
      since: { type: 'string', description: 'ISO date or relative (24h, 2d). Default: 24h' },
    },
    run({ args }) {
      const root = findRepoRoot(process.cwd());
      const since = parseSince(args.since);
      const dir = ledgerDir(root);

      // Collect enough days to cover the since window
      const daysBack = Math.ceil((Date.now() - since.getTime()) / 86400000) + 1;
      const rows = collectLedgerRows(root, daysBack)
        .filter((r) => r.runtime === 'codex-cli' && new Date(r.ts) >= since)
        .sort((a, b) => new Date(a.ts) - new Date(b.ts));

      if (rows.length === 0) {
        console.log(`No codex ledger entries since ${since.toISOString()}.`);
        return;
      }

      const W = { ts: 26, model: 28, prompt: 10, completion: 12, source: 20 };
      const header = [
        pad('ts', W.ts), pad('model', W.model),
        pad('prompt_t', W.prompt, true), pad('completion_t', W.completion, true),
        pad('source', W.source),
      ].join('  ');
      console.log(`\nCodex invocations since ${since.toISOString()}  (${rows.length} rows)\n`);
      console.log(header);
      console.log('-'.repeat(header.length));
      for (const r of rows) {
        console.log([
          pad(r.ts, W.ts),
          pad(r.model || 'unknown', W.model),
          pad(fmtNum(r.prompt_tokens), W.prompt, true),
          pad(fmtNum(r.completion_tokens), W.completion, true),
          pad(r.source || '', W.source),
        ].join('  '));
      }
    },
  });
}

// ── unknown subcommand ────────────────────────────────────────────────────────

function createUnknownCommand() {
  return defineCommand({
    meta: { name: 'unknown', description: 'Find trace-events rows with no matching ai-spend-ledger entry (possible capture leaks)' },
    args: {},
    run() {
      const root = findRepoRoot(process.cwd());
      const traceRows = readJsonl(traceFile(root));
      const ledgerRows = collectLedgerRows(root, 3); // look back 3 days

      if (traceRows.length === 0) {
        console.log('No trace-events found. (expected at .planning/.trace-events.jsonl)');
        return;
      }

      // Build set of session_ids present in ledger
      const ledgerSessions = new Set(ledgerRows.map((r) => r.session_id).filter(Boolean));

      // Find trace rows that look like tool-use (kind = tool_use / api_call)
      // but whose session_id has no ledger entry at all
      const leaked = traceRows.filter((r) => {
        if (!r.session_id) return false;
        if (ledgerSessions.has(r.session_id)) return false;
        // Only flag rows that represent actual model invocations
        const k = (r.kind || r.type || '').toLowerCase();
        return k.includes('tool') || k.includes('api') || k.includes('stop');
      });

      if (leaked.length === 0) {
        console.log('No unmatched trace-event sessions found in the last 3 days of ledger.');
        return;
      }

      // Dedupe by session_id + runtime
      const seen = new Set();
      const unique = leaked.filter((r) => {
        const key = `${r.session_id}||${(r.runtime && r.runtime.id) || r.runtime || 'unknown'}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`\nUnmatched trace-event sessions (no ledger entry, last 3 days)  ${unique.length} unique:\n`);
      const W = { ts: 26, session: 36, runtime: 16, kind: 18 };
      console.log([pad('ts', W.ts), pad('session_id', W.session), pad('runtime', W.runtime), pad('kind', W.kind)].join('  '));
      console.log('-'.repeat(W.ts + W.session + W.runtime + W.kind + 6));
      for (const r of unique.slice(0, 50)) {
        const rt = (r.runtime && r.runtime.id) || r.runtime || 'unknown';
        console.log([
          pad(r.ts || '', W.ts),
          pad(r.session_id || '', W.session),
          pad(rt, W.runtime),
          pad(r.kind || r.type || '', W.kind),
        ].join('  '));
      }
      if (unique.length > 50) console.log(`... and ${unique.length - 50} more`);
    },
  });
}

// ── top-level audit command ───────────────────────────────────────────────────

function createRuntimeAuditCommand() {
  return defineCommand({
    meta: {
      name: 'audit',
      description: 'Inspect cross-runtime AI spend ledger and trace coverage',
    },
    subCommands: {
      summary: createSummaryCommand(),
      codex: createCodexCommand(),
      unknown: createUnknownCommand(),
    },
  });
}

module.exports = { createRuntimeAuditCommand };
