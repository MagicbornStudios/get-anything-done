'use strict';
/**
 * gad design — design-decisions corpus CLI (GLOBAL-D-322 item 6).
 *
 * Subcommands:
 *   list [--status live|superseded|archived] [--json]
 *   show <id> [--body] [--json]
 *   add <id> --title "..." --problem "..." --reasoning "..." --fix "..." --principle "..."
 *            [--refs "a,b,c"] [--status live]
 *   supersede <old-id> --by <new-id> --reason "..."
 *   archive <id> --reason "..."
 *
 * Auto-discovered by bin/commands/_loader.cjs — no gad.cjs edits needed.
 */

const path = require('node:path');
const fs   = require('node:fs');
const { defineCommand } = require('citty');

const {
  readDesignDecisions,
  readDesignDecision,
  writeDesignDecision,
  supersede,
  archive,
} = require('../../lib/design-decisions.cjs');

// ─── Helper ───────────────────────────────────────────────────────────────────

function resolvePlanningDir(deps) {
  try {
    return path.join(deps.findRepoRoot(), '.planning');
  } catch (_) {
    return path.join(process.cwd(), '.planning');
  }
}

function splitRefs(raw) {
  if (!raw) return [];
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createDesignCommand(deps) {
  const { outputError, render, shouldUseJson } = deps;

  // ── list ──────────────────────────────────────────────────────────────────
  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List design decisions' },
    args: {
      status: { type: 'string', description: 'Filter by status: live | superseded | archived', default: '' },
      json:   { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const filter = args.status ? { status: args.status } : {};
      const entries = readDesignDecisions(planningDir, filter);

      if (entries.length === 0) {
        console.log('No design decisions found.');
        return;
      }

      const fmt = (args.json || shouldUseJson()) ? 'json' : 'table';
      if (fmt === 'json') {
        console.log(JSON.stringify(entries.map(({ body: _b, _file: _f, ...e }) => e), null, 2));
        return;
      }

      const rows = entries.map((e) => ({
        id:        e.id,
        status:    e.status,
        title:     e.title.length > 55 ? e.title.slice(0, 52) + '...' : e.title,
        principle: e.principle.length > 70 ? e.principle.slice(0, 67) + '...' : e.principle,
      }));
      console.log(render(rows, { format: 'table', title: `Design Decisions (${rows.length})` }));
    },
  });

  // ── show ──────────────────────────────────────────────────────────────────
  const showCmd = defineCommand({
    meta: { name: 'show', description: 'Show a design decision by id' },
    args: {
      id:   { type: 'positional', description: 'Design decision id (e.g. dd-001)', required: true },
      body: { type: 'boolean',    description: 'Include the long-form body section', default: false },
      json: { type: 'boolean',    description: 'JSON output', default: false },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const entry = readDesignDecision(planningDir, String(args.id));
      if (!entry) {
        outputError(`Design decision not found: ${args.id}`);
        process.exit(1);
        return;
      }

      if (args.json || shouldUseJson()) {
        const out = { ...entry };
        if (!args.body) delete out.body;
        delete out._file;
        console.log(JSON.stringify(out, null, 2));
        return;
      }

      console.log(`ID:        ${entry.id}`);
      console.log(`Status:    ${entry.status}`);
      console.log(`Title:     ${entry.title}`);
      console.log(`Created:   ${entry.created_at}`);
      if (entry.supersedes)     console.log(`Supersedes:    ${entry.supersedes}`);
      if (entry.superseded_by)  console.log(`Superseded by: ${entry.superseded_by}`);
      console.log('');
      console.log('Problem:');
      console.log(`  ${entry.problem}`);
      console.log('');
      console.log('Reasoning:');
      console.log(`  ${entry.reasoning}`);
      console.log('');
      console.log('Fix:');
      console.log(`  ${entry.fix}`);
      console.log('');
      console.log('Principle:');
      console.log(`  ${entry.principle}`);
      if (entry.refs && entry.refs.length > 0) {
        console.log('');
        console.log('Refs:');
        for (const r of entry.refs) console.log(`  - ${r}`);
      }
      if (args.body && entry.body) {
        console.log('');
        console.log('─'.repeat(60));
        console.log(entry.body);
      }
    },
  });

  // ── add ──────────────────────────────────────────────────────────────────
  const addCmd = defineCommand({
    meta: { name: 'add', description: 'Add a new design decision entry' },
    args: {
      id:        { type: 'positional', description: 'Entry id (e.g. dd-004)',  required: true },
      title:     { type: 'string',     description: 'Short title',             required: true },
      problem:   { type: 'string',     description: 'Problem statement',       required: true },
      reasoning: { type: 'string',     description: 'Why this fix was chosen', required: true },
      fix:       { type: 'string',     description: 'What was changed',        required: true },
      principle: { type: 'string',     description: 'Durable rule extracted',  required: true },
      refs:      { type: 'string',     description: 'Comma-separated refs',    default: '' },
      status:    { type: 'string',     description: 'Status (default: live)',   default: 'live' },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const id = String(args.id || '').trim();
      if (!id) {
        outputError('design add: id is required');
        process.exit(1);
        return;
      }

      // Prevent duplicate id
      const existing = readDesignDecision(planningDir, id);
      if (existing) {
        outputError(`design add: entry "${id}" already exists at ${existing._file}`);
        process.exit(1);
        return;
      }

      const filePath = writeDesignDecision(planningDir, {
        id,
        title:     args.title,
        problem:   args.problem,
        reasoning: args.reasoning,
        fix:       args.fix,
        principle: args.principle,
        refs:      splitRefs(args.refs),
        status:    args.status || 'live',
      });
      console.log(`design add: created ${filePath}`);
    },
  });

  // ── supersede ─────────────────────────────────────────────────────────────
  const supersedeCmd = defineCommand({
    meta: { name: 'supersede', description: 'Mark a design decision as superseded by a newer one' },
    args: {
      id:     { type: 'positional', description: 'Id of entry being superseded', required: true },
      by:     { type: 'string',     description: 'Id of the new superseding entry', required: true },
      reason: { type: 'string',     description: 'Why it was superseded', default: '' },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const oldId = String(args.id || '').trim();
      const newId = String(args.by || '').trim();
      if (!oldId || !newId) {
        outputError('design supersede: both <id> and --by <new-id> are required');
        process.exit(1);
        return;
      }
      const filePath = supersede(planningDir, oldId, newId, args.reason || '');
      console.log(`design supersede: ${oldId} marked superseded by ${newId} (${filePath})`);
    },
  });

  // ── archive ───────────────────────────────────────────────────────────────
  const archiveCmd = defineCommand({
    meta: { name: 'archive', description: 'Mark a design decision as archived' },
    args: {
      id:     { type: 'positional', description: 'Id to archive', required: true },
      reason: { type: 'string',     description: 'Why it was archived', default: '' },
    },
    run({ args }) {
      const planningDir = resolvePlanningDir(deps);
      const id = String(args.id || '').trim();
      if (!id) {
        outputError('design archive: id is required');
        process.exit(1);
        return;
      }
      const filePath = archive(planningDir, id, args.reason || '');
      console.log(`design archive: ${id} archived (${filePath})`);
    },
  });

  // ── root ─────────────────────────────────────────────────────────────────
  return defineCommand({
    meta: {
      name: 'design',
      description: 'Design-decisions corpus — capture design errors, reasoning, and principled fixes for SLM training (GLOBAL-D-322 item 6)',
    },
    subCommands: {
      list:      listCmd,
      show:      showCmd,
      add:       addCmd,
      supersede: supersedeCmd,
      archive:   archiveCmd,
    },
  });
}

module.exports = { createDesignCommand };
module.exports.register = (ctx) => ({ design: createDesignCommand(ctx.common) });
