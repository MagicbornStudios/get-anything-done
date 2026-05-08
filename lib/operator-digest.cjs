'use strict';
/**
 * lib/operator-digest.cjs — Operator-only digest builder (GLOBAL-D-321 Phase F).
 *
 * Reads .planning/operator-todos/<id>.json and auto-populates from three
 * live sources:
 *   1. Preference pairs awaiting human pick (.planning/datasets/preference-pairs/*.jsonl)
 *   2. Irreversible/destructive handoffs awaiting approval (.planning/handoffs/open/)
 *   3. Stuck handoffs claimed >2h (.planning/handoffs/claimed/)
 *
 * Design:
 *   - File-system reads only. No subprocess spawns, no auth.
 *   - Safe to call from the sidecar (Tauri invoke) or CLI.
 *   - Items are sorted: overdue > blocking > due_at ASC > created_at ASC.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} OperatorTodo
 * @property {string}   id
 * @property {string}   kind  "review-pref-pair|approve-copy|approve-action|business|legal|standup"
 * @property {string}   summary
 * @property {string?}  context_url
 * @property {string[]} evidence_refs
 * @property {string}   created_at    ISO-8601
 * @property {string?}  due_at        ISO-8601
 * @property {boolean}  blocking
 * @property {string?}  completed_at
 * @property {string?}  completion_note
 * @property {string?}  _source        "file|pref-pair|handoff|stuck-handoff"
 */

const KIND_ORDER = [
  'approve-action',
  'approve-copy',
  'review-pref-pair',
  'legal',
  'business',
  'standup',
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function nowIso() { return new Date().toISOString(); }

function isOverdue(item) {
  if (!item.due_at || item.completed_at) return false;
  return new Date(item.due_at) < new Date();
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    // 1. completed items last
    const aCmp = a.completed_at ? 1 : 0;
    const bCmp = b.completed_at ? 1 : 0;
    if (aCmp !== bCmp) return aCmp - bCmp;
    // 2. overdue first
    const aOvr = isOverdue(a) ? 0 : 1;
    const bOvr = isOverdue(b) ? 0 : 1;
    if (aOvr !== bOvr) return aOvr - bOvr;
    // 3. blocking next
    const aBlk = a.blocking ? 0 : 1;
    const bBlk = b.blocking ? 0 : 1;
    if (aBlk !== bBlk) return aBlk - bBlk;
    // 4. due_at ASC (items without due_at go last)
    if (a.due_at && b.due_at) return a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : 0;
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    // 5. created_at ASC
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Source: .planning/operator-todos/*.json
// ---------------------------------------------------------------------------

function loadFileTodos(baseDir) {
  const dir = path.join(baseDir, '.planning', 'operator-todos');
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const data = readJson(path.join(dir, f));
    if (!data || !data.id) continue;
    results.push({
      id: data.id,
      kind: data.kind || 'standup',
      summary: data.summary || '',
      context_url: data.context_url || null,
      evidence_refs: Array.isArray(data.evidence_refs) ? data.evidence_refs : [],
      created_at: data.created_at || nowIso(),
      due_at: data.due_at || null,
      blocking: !!data.blocking,
      completed_at: data.completed_at || null,
      completion_note: data.completion_note || null,
      _source: 'file',
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Source: preference pairs with operator_choice=null
// ---------------------------------------------------------------------------

function loadPrefPairTodos(baseDir) {
  const dir = path.join(baseDir, '.planning', 'datasets', 'preference-pairs');
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jsonl')) continue;
    const lines = (() => {
      try { return fs.readFileSync(path.join(dir, f), 'utf8').split('\n'); } catch { return []; }
    })();
    let pendingCount = 0;
    let firstTs = null;
    for (const line of lines) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry.operator_choice == null && !entry.completed_at) {
        pendingCount++;
        if (!firstTs && entry.created_at) firstTs = entry.created_at;
      }
    }
    if (pendingCount > 0) {
      const id = `pref-pair:${f.replace('.jsonl', '')}`;
      results.push({
        id,
        kind: 'review-pref-pair',
        summary: `${pendingCount} preference pair${pendingCount > 1 ? 's' : ''} awaiting your pick in ${f}`,
        context_url: null,
        evidence_refs: [path.join('.planning', 'datasets', 'preference-pairs', f)],
        created_at: firstTs || nowIso(),
        due_at: null,
        blocking: false,
        completed_at: null,
        completion_note: null,
        _source: 'pref-pair',
        _count: pendingCount,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Source: handoffs open with risk:irreversible or risk:destructive
// ---------------------------------------------------------------------------

const RISK_RE = /\brisk:\s*(irreversible|destructive)\b/i;

function loadHandoffApprovalTodos(baseDir) {
  const dir = path.join(baseDir, '.planning', 'handoffs', 'open');
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const fPath = path.join(dir, f);
    let text;
    try { text = fs.readFileSync(fPath, 'utf8'); } catch { continue; }
    if (!RISK_RE.test(text)) continue;
    const stat = fs.statSync(fPath);
    const id = `handoff-approval:${f}`;
    results.push({
      id,
      kind: 'approve-action',
      summary: `Handoff ${f} requires human approval (risk: irreversible/destructive)`,
      context_url: null,
      evidence_refs: [path.join('.planning', 'handoffs', 'open', f)],
      created_at: stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString(),
      due_at: null,
      blocking: true,
      completed_at: null,
      completion_note: null,
      _source: 'handoff',
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Source: handoffs claimed >2h (stuck)
// ---------------------------------------------------------------------------

const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h

function loadStuckHandoffTodos(baseDir) {
  const dir = path.join(baseDir, '.planning', 'handoffs', 'claimed');
  if (!fs.existsSync(dir)) return [];
  const now = Date.now();
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const fPath = path.join(dir, f);
    let stat;
    try { stat = fs.statSync(fPath); } catch { continue; }
    const ageMs = now - stat.mtimeMs;
    if (ageMs < STUCK_THRESHOLD_MS) continue;
    const ageH = Math.round(ageMs / 3_600_000);
    const id = `stuck-handoff:${f}`;
    results.push({
      id,
      kind: 'approve-action',
      summary: `Handoff ${f} has been claimed for ${ageH}h without completion — may need intervention`,
      context_url: null,
      evidence_refs: [path.join('.planning', 'handoffs', 'claimed', f)],
      created_at: stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString(),
      due_at: null,
      blocking: false,
      completed_at: null,
      completion_note: null,
      _source: 'stuck-handoff',
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all pending operator todos (file + auto-populated sources).
 * Returns sorted array of OperatorTodo objects.
 * @param {string} baseDir  — repo root
 * @param {boolean} includeCompleted
 */
function loadAllTodos(baseDir, includeCompleted = false) {
  const all = [
    ...loadFileTodos(baseDir),
    ...loadPrefPairTodos(baseDir),
    ...loadHandoffApprovalTodos(baseDir),
    ...loadStuckHandoffTodos(baseDir),
  ];

  // Deduplicate by id (file-based items win over auto-populated)
  const seen = new Map();
  for (const item of all) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }

  let items = [...seen.values()];
  if (!includeCompleted) {
    items = items.filter((i) => !i.completed_at);
  }
  return sortItems(items);
}

/**
 * Group items by kind, return map kind -> items[].
 */
function groupByKind(items) {
  const map = {};
  for (const kind of KIND_ORDER) map[kind] = [];
  for (const item of items) {
    if (!map[item.kind]) map[item.kind] = [];
    map[item.kind].push(item);
  }
  // Remove empty groups
  for (const k of Object.keys(map)) {
    if (map[k].length === 0) delete map[k];
  }
  return map;
}

/**
 * Render human-readable text digest.
 * @param {string} baseDir
 */
function renderTextDigest(baseDir) {
  const items = loadAllTodos(baseDir);
  if (items.length === 0) {
    return '=== Operator Digest ===\nNo pending operator items. You are clear.\n';
  }

  const groups = groupByKind(items);
  const overdue = items.filter(isOverdue);
  const blocking = items.filter((i) => i.blocking && !isOverdue(i));

  const lines = ['=== Operator Digest ==='];
  lines.push(`${items.length} pending item${items.length > 1 ? 's' : ''}`);
  if (overdue.length) lines.push(`  OVERDUE: ${overdue.length}`);
  if (blocking.length) lines.push(`  BLOCKING: ${blocking.length}`);
  lines.push('');

  const kindLabel = {
    'review-pref-pair': 'Review: Preference Pairs',
    'approve-copy':     'Approve: Copy / Marketing',
    'approve-action':   'Approve: Agent Actions',
    'business':         'Business / Decisions',
    'legal':            'Legal / Regulatory',
    'standup':          'Standup / Status',
  };

  for (const [kind, kindItems] of Object.entries(groups)) {
    lines.push(`--- ${kindLabel[kind] || kind} (${kindItems.length}) ---`);
    for (const item of kindItems) {
      const flags = [];
      if (isOverdue(item)) flags.push('OVERDUE');
      if (item.blocking) flags.push('BLOCKING');
      const flagStr = flags.length ? ` [${flags.join(', ')}]` : '';
      lines.push(`  [${item.id}]${flagStr}`);
      lines.push(`  ${item.summary}`);
      if (item.due_at) lines.push(`  Due: ${item.due_at}`);
      if (item.context_url) lines.push(`  URL: ${item.context_url}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

/**
 * Build structured JSON digest for the Kael overlay.
 * @param {string} baseDir
 */
function buildJsonDigest(baseDir) {
  const items = loadAllTodos(baseDir);
  const groups = groupByKind(items);
  const overdue = items.filter(isOverdue);
  const blocking = items.filter((i) => i.blocking);

  return {
    total: items.length,
    overdue: overdue.length,
    blocking: blocking.length,
    badge_color: overdue.length > 0 ? 'red' : blocking.length > 0 ? 'gold' : 'default',
    groups,
    items,
    generated_at: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

/** Resolve the operator-todos dir, creating it if needed. */
function resolveTodosDir(baseDir) {
  const dir = path.join(baseDir, '.planning', 'operator-todos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write a new operator todo to disk. Returns the item. */
function writeTodo(baseDir, item) {
  const dir = resolveTodosDir(baseDir);
  const id = item.id || `op-${Date.now()}`;
  const todo = {
    id,
    kind: item.kind || 'standup',
    summary: item.summary || '',
    context_url: item.context_url || null,
    evidence_refs: item.evidence_refs || [],
    created_at: item.created_at || nowIso(),
    due_at: item.due_at || null,
    blocking: !!item.blocking,
    completed_at: null,
    completion_note: null,
  };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(todo, null, 2) + '\n', 'utf8');
  return todo;
}

/** Mark a file-based todo as complete. Returns updated item or null. */
function completeTodo(baseDir, id, note) {
  const dir = resolveTodosDir(baseDir);
  const fPath = path.join(dir, `${id}.json`);
  if (!fs.existsSync(fPath)) return null;
  const data = readJson(fPath);
  if (!data) return null;
  data.completed_at = nowIso();
  data.completion_note = note || null;
  fs.writeFileSync(fPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return data;
}

module.exports = {
  loadAllTodos,
  groupByKind,
  renderTextDigest,
  buildJsonDigest,
  writeTodo,
  completeTodo,
  isOverdue,
  KIND_ORDER,
};
