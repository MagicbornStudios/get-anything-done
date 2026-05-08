'use strict';
/**
 * gad operator — CLI for the operator-only digest queue (GLOBAL-D-321 Phase F).
 *
 * Subcommands:
 *   gad operator digest [--json]   — text or JSON rollup of pending items
 *   gad operator queue             — list pending items (table or JSON)
 *   gad operator clear <id> [--note "..."]  — mark item complete
 *   gad operator add <kind> --summary "..." [--due "..."] [--blocking] [--url "..."]
 *
 * New commands (no factory deps needed): filesystem-only, uses lib/operator-digest.cjs.
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');
const {
  loadAllTodos,
  groupByKind,
  renderTextDigest,
  buildJsonDigest,
  writeTodo,
  completeTodo,
  isOverdue,
  KIND_ORDER,
} = require('../../lib/operator-digest.cjs');

const dependsOn = [];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function resolveBase(findRepoRoot) {
  return findRepoRoot ? findRepoRoot() : process.cwd();
}

const KIND_LABEL = {
  'review-pref-pair': 'review-pref-pair',
  'approve-copy':     'approve-copy',
  'approve-action':   'approve-action',
  'business':         'business',
  'legal':            'legal',
  'standup':          'standup',
};

// ---------------------------------------------------------------------------
// gad operator digest
// ---------------------------------------------------------------------------

function makeDigestCmd(deps) {
  const { findRepoRoot, render } = deps;
  return defineCommand({
    meta: {
      name: 'digest',
      description: 'Show operator-only daily digest (pending items requiring human action)',
    },
    args: {
      json: { type: 'boolean', description: 'Output structured JSON for overlay', default: false },
    },
    run({ args }) {
      const baseDir = resolveBase(findRepoRoot);
      if (args.json) {
        const data = buildJsonDigest(baseDir);
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(renderTextDigest(baseDir));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// gad operator queue
// ---------------------------------------------------------------------------

function makeQueueCmd(deps) {
  const { findRepoRoot, render } = deps;
  return defineCommand({
    meta: {
      name: 'queue',
      description: 'List pending operator-only items',
    },
    args: {
      json: { type: 'boolean', description: 'JSON output', default: false },
      all:  { type: 'boolean', description: 'Include completed items', default: false },
    },
    run({ args }) {
      const baseDir = resolveBase(findRepoRoot);
      const items = loadAllTodos(baseDir, args.all);
      if (args.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }
      if (items.length === 0) {
        console.log('No pending operator items.');
        return;
      }
      // Text table
      const rows = items.map((item) => {
        const flags = [];
        if (isOverdue(item)) flags.push('OVERDUE');
        if (item.blocking) flags.push('BLOCKING');
        return [
          item.id.length > 36 ? item.id.slice(0, 35) + '…' : item.id,
          item.kind,
          flags.join(' ') || '-',
          item.due_at ? item.due_at.slice(0, 10) : '-',
          item.summary.slice(0, 60),
        ];
      });
      const headers = ['ID', 'KIND', 'FLAGS', 'DUE', 'SUMMARY'];
      // Column widths
      const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
      const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
      console.log(line(headers));
      console.log(widths.map((w) => '-'.repeat(w)).join('  '));
      for (const row of rows) console.log(line(row));
    },
  });
}

// ---------------------------------------------------------------------------
// gad operator clear
// ---------------------------------------------------------------------------

function makeClearCmd(deps) {
  const { findRepoRoot, outputError } = deps;
  return defineCommand({
    meta: {
      name: 'clear',
      description: 'Mark a file-based operator todo as complete',
    },
    args: {
      id:   { type: 'positional', description: 'Todo id to complete', required: true },
      note: { type: 'string', description: 'Optional completion note', default: '' },
    },
    run({ args }) {
      const baseDir = resolveBase(findRepoRoot);
      const result = completeTodo(baseDir, args.id, args.note || null);
      if (!result) {
        const msg = `Operator todo not found: ${args.id}. Only file-based items (created via 'gad operator add') can be cleared this way.`;
        if (outputError) outputError(msg);
        else console.error(msg);
        process.exit(1);
      }
      console.log(`Cleared: ${result.id}`);
      if (result.completion_note) console.log(`Note: ${result.completion_note}`);
    },
  });
}

// ---------------------------------------------------------------------------
// gad operator add
// ---------------------------------------------------------------------------

function makeAddCmd(deps) {
  const { findRepoRoot, outputError } = deps;
  return defineCommand({
    meta: {
      name: 'add',
      description: 'Add a new operator-only todo item',
    },
    args: {
      kind:     { type: 'positional', description: `Kind: ${KIND_ORDER.join('|')}`, required: true },
      summary:  { type: 'string', description: 'One-line summary', required: true },
      due:      { type: 'string', description: 'Due date (ISO-8601 or natural date like "2026-05-10")', default: '' },
      blocking: { type: 'boolean', description: 'Mark as blocking agents', default: false },
      url:      { type: 'string', description: 'Optional context URL', default: '' },
    },
    run({ args }) {
      if (!KIND_ORDER.includes(args.kind)) {
        const msg = `Unknown kind "${args.kind}". Valid kinds: ${KIND_ORDER.join(', ')}`;
        if (outputError) outputError(msg);
        else console.error(msg);
        process.exit(1);
      }
      const baseDir = resolveBase(findRepoRoot);
      const id = `op-${Date.now()}`;
      const todo = writeTodo(baseDir, {
        id,
        kind: args.kind,
        summary: args.summary,
        context_url: args.url || null,
        due_at: args.due || null,
        blocking: !!args.blocking,
      });
      console.log(`Added: ${todo.id} [${todo.kind}]`);
      console.log(`  ${todo.summary}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

function register(ctx) {
  const { common } = ctx;
  const deps = common || {};

  const operatorCmd = defineCommand({
    meta: {
      name: 'operator',
      description: 'Operator-only work queue — daily digest, approval queue, clearing items',
    },
    subCommands: {
      digest: makeDigestCmd(deps),
      queue:  makeQueueCmd(deps),
      clear:  makeClearCmd(deps),
      add:    makeAddCmd(deps),
    },
  });

  return { operator: operatorCmd };
}

module.exports = { register, dependsOn };
