'use strict';
/**
 * gad feedback — record preference-pair training data.
 *
 * Extracted as a standalone module per sweep E factory pattern.
 * Auto-discovered by bin/commands/_loader.cjs — no gad.cjs edits needed.
 *
 * Subcommands:
 *   record  — append (or idempotently replace) one preference-pair row to
 *             .planning/datasets/preference-pairs/<YYYY-MM-DD>.jsonl
 */

const fs = require('node:fs');
const path = require('node:path');
const { defineCommand } = require('citty');
const { detectRuntimeIdentity, detectRuntimeSessionId } = require('../../lib/runtime-detect.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve the .planning/datasets/preference-pairs directory.
 * Uses findRepoRoot when available; falls back to cwd.
 */
function resolvePairsDir(findRepoRoot) {
  try {
    const root = findRepoRoot();
    return path.join(root, '.planning', 'datasets', 'preference-pairs');
  } catch (_) {
    return path.join(process.cwd(), '.planning', 'datasets', 'preference-pairs');
  }
}

/**
 * Build a preference-pair row from CLI args + auto-detected telemetry.
 */
function buildRow(args) {
  const rt = detectRuntimeIdentity();
  const sessionId = detectRuntimeSessionId();
  const agentId = (process.env.GAD_AGENT_NAME || process.env.GAD_AGENT_ID || '').trim() || null;

  const rejected = [];
  if (args['rejected-labels']) {
    const csv = String(args['rejected-labels']);
    csv.split(',').forEach((label, idx) => {
      const l = label.trim();
      if (l) rejected.push({ label: l, index: idx });
    });
  }

  const row = {
    ts: new Date().toISOString(),
    turn_id: String(args['turn-id']),
    projectid: String(args.projectid || ''),
    question: String(args.question),
    picked: {
      label: String(args['picked-label']),
      index: parseInt(String(args['picked-index']), 10),
    },
    rejected,
    agent_id: agentId,
    runtime: rt.id || 'unknown',
    session_id: sessionId || null,
  };

  if (args.reason) row.reason = String(args.reason);
  if (args['fragment-content']) row.fragment_content = String(args['fragment-content']);

  return row;
}

/**
 * Append or idempotently replace one row in the target JSONL file.
 * If a row with the same turn_id already exists, replace it.
 */
function upsertRow(filePath, row) {
  let lines = [];
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (raw) lines = raw.split('\n');
  }

  const turnId = row.turn_id;
  const serialized = JSON.stringify(row);
  let replaced = false;
  lines = lines.map((line) => {
    if (!line.trim()) return line;
    try {
      const parsed = JSON.parse(line);
      if (parsed.turn_id === turnId) { replaced = true; return serialized; }
    } catch (_) {}
    return line;
  });

  if (!replaced) lines.push(serialized);

  fs.writeFileSync(filePath, lines.filter((l) => l.trim()).join('\n') + '\n', 'utf8');
  return { replaced };
}

// ─── Command factory ──────────────────────────────────────────────────────────

function createFeedbackCommand(deps) {
  const { findRepoRoot, outputError } = deps || {};

  const recordCmd = defineCommand({
    meta: {
      name: 'record',
      description: 'Record a preference-pair row into .planning/datasets/preference-pairs/<date>.jsonl. Idempotent: same turn-id on the same day replaces the existing row.',
    },
    args: {
      'turn-id':          { type: 'string',  description: 'Unique turn identifier (e.g. cuid, uuid, or AskUserQuestion call id)', required: true },
      question:           { type: 'string',  description: 'The question text shown to the user', required: true },
      'picked-label':     { type: 'string',  description: 'Label of the option the user selected', required: true },
      'picked-index':     { type: 'string',  description: 'Zero-based index of the selected option', required: true },
      'rejected-labels':  { type: 'string',  description: 'CSV of labels NOT selected (e.g. "option b,option c")', default: '' },
      reason:             { type: 'string',  description: 'Optional freeform reason or context', default: '' },
      'fragment-content': { type: 'string',  description: 'Abbreviated preview text shown for each choice fragment', default: '' },
      projectid:          { type: 'string',  description: 'Project id for scoping', default: '' },
    },
    run({ args }) {
      // Validate required args manually (citty marks them required but we want a clean error)
      if (!args['turn-id'])      { if (outputError) outputError('--turn-id is required'); else console.error('--turn-id is required'); process.exit(1); return; }
      if (!args.question)        { if (outputError) outputError('--question is required'); else console.error('--question is required'); process.exit(1); return; }
      if (!args['picked-label']) { if (outputError) outputError('--picked-label is required'); else console.error('--picked-label is required'); process.exit(1); return; }
      if (args['picked-index'] === undefined || args['picked-index'] === '') {
        if (outputError) outputError('--picked-index is required');
        else console.error('--picked-index is required');
        process.exit(1);
        return;
      }

      const pairsDir = resolvePairsDir(findRepoRoot);
      fs.mkdirSync(pairsDir, { recursive: true });

      const date = todayIso();
      const filePath = path.join(pairsDir, `${date}.jsonl`);

      const row = buildRow(args);
      const { replaced } = upsertRow(filePath, row);

      console.log(`feedback record: ${replaced ? 'replaced' : 'appended'} turn_id=${row.turn_id} → ${filePath}`);
    },
  });

  return defineCommand({
    meta: {
      name: 'feedback',
      description: 'Record preference-pair training signals (AskUserQuestion answers, format picks, etc.)',
    },
    subCommands: {
      record: recordCmd,
    },
  });
}

module.exports = { createFeedbackCommand };
module.exports.register = (ctx) => ({ feedback: createFeedbackCommand(ctx.common) });
