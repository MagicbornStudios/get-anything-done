'use strict';

/**
 * Savings reporting core for the pricing/value story.
 *
 * The module is intentionally read-only and best-effort:
 * - Prefer concrete savings ledger records when present.
 * - Use cached totals only to calibrate a frontier USD/token rate.
 * - Fall back to deterministic estimates when detailed context-pack logs
 *   are missing.
 *
 * Export:
 *   computeSavings({ projectRoot, since, projectid })
 */

const fs = require('node:fs');
const path = require('node:path');
const { estimateTokens } = require('../token-estimator.cjs');
const { findRepoRoot } = require('../spend-ledger.cjs');
const { listHandoffs, parseFrontmatter } = require('../handoffs.cjs');
const taskFiles = require('../task-files.cjs');

const DEFAULT_FRONTIER_RATE_USD_PER_TOKEN = 0.000003;
const DEFAULT_CONTEXT_PACK_SAVINGS_PER_HANDOFF = 120;
const DEFAULT_LOCAL_ROUTING_MIN_SAVINGS = 120;
const DEFAULT_LOCAL_ROUTING_MULTIPLIER = 1.35;

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toMs(value) {
  const iso = toIso(value);
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function ensureNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeReadJsonl(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {
        // Skip corrupt lines. Savings data is append-only and should be
        // resilient to the odd partial write.
      }
    }
    return rows;
  } catch {
    return null;
  }
}

function walkFiles(rootDir) {
  const out = [];
  if (!rootDir || !fs.existsSync(rootDir)) return out;
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  return out;
}

function resolveLedgerFiles(projectRoot) {
  const root = projectRoot;
  const planningDir = path.join(root, '.planning');
  const candidates = [
    path.join(planningDir, 'savings-ledger.json'),
    path.join(planningDir, 'savings-ledger.jsonl'),
    path.join(planningDir, '.savings-ledger.json'),
    path.join(planningDir, '.savings-ledger.jsonl'),
  ];
  const ledgerPath = candidates.find((p) => fs.existsSync(p)) || null;

  const metricsDir = path.join(root, '.gad', 'metrics');
  const metricsExists = fs.existsSync(metricsDir) ? metricsDir : null;

  const cachePath = path.join(planningDir, '.savings-cache.json');
  return { ledgerPath, metricsDir: metricsExists, cachePath };
}

function parseRecordArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return [value];
  return [];
}

function loadSavingsRecords(ledgerPath) {
  if (!ledgerPath) return [];
  if (ledgerPath.endsWith('.jsonl')) {
    const rows = safeReadJsonl(ledgerPath);
    return Array.isArray(rows) ? rows : [];
  }
  const parsed = safeReadJson(ledgerPath);
  if (!parsed) return [];
  return parseRecordArray(parsed.records || parsed.entries || parsed.data || parsed);
}

function loadMetricsRecords(metricsDir) {
  if (!metricsDir) return [];
  const records = [];
  for (const filePath of walkFiles(metricsDir)) {
    if (!/\.(json|jsonl)$/i.test(filePath)) continue;
    const parsed = filePath.endsWith('.jsonl') ? safeReadJsonl(filePath) : safeReadJson(filePath);
    if (Array.isArray(parsed)) {
      records.push(...parsed.filter(Boolean));
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.records)) records.push(...parsed.records.filter(Boolean));
      else if (Array.isArray(parsed.entries)) records.push(...parsed.entries.filter(Boolean));
      else records.push(parsed);
    }
  }
  return records;
}

function recordTimestamp(record) {
  if (!record || typeof record !== 'object') return null;
  return toMs(record.ts || record.timestamp || record.created_at || record.updated_at || record.time);
}

function recordSavingsTokens(record) {
  if (!record || typeof record !== 'object') return 0;
  const delta = ensureNumber(record.delta_tokens);
  if (delta != null && delta < 0) return Math.abs(delta);

  const before = ensureNumber(record.before_tokens);
  const after = ensureNumber(record.after_tokens);
  if (before != null && after != null && before > after) return before - after;

  const saved = ensureNumber(record.tokens_saved);
  if (saved != null && saved > 0) return saved;

  const altSaved = ensureNumber(record.saved_tokens);
  if (altSaved != null && altSaved > 0) return altSaved;

  return 0;
}

function recordKind(record) {
  const raw = record && (record.kind || record.type || record.event || record.metric_kind);
  return raw ? String(raw).toLowerCase() : '';
}

function recordSource(record) {
  const raw = record && (record.source || record.source_event || record.runtime || record.adapter || record.tool);
  return raw ? String(raw).toLowerCase() : '';
}

function matchesSince(record, sinceMs) {
  if (!sinceMs) return true;
  const ms = recordTimestamp(record);
  return ms == null ? false : ms >= sinceMs;
}

function isToolCallSavingsRecord(record) {
  const kind = recordKind(record);
  const source = recordSource(record);
  return kind === 'tool_call' || source.includes('rtk') || source.includes('proxy') || source.includes('tool-call');
}

function isContextPackRecord(record) {
  const kind = recordKind(record);
  const source = recordSource(record);
  return kind === 'compression' || kind === 'context_pack' || source.includes('context-pack') || source.includes('compression');
}

function summarizeRecords(records, sinceMs) {
  const summary = {
    tool_call_savings: 0,
    context_pack_savings: 0,
    tool_call_entries: 0,
    context_pack_entries: 0,
    raw_records: 0,
  };

  for (const record of records) {
    if (!record || typeof record !== 'object') continue;
    if (!matchesSince(record, sinceMs)) continue;
    summary.raw_records += 1;

    const savings = recordSavingsTokens(record);
    if (!savings) continue;

    if (isToolCallSavingsRecord(record)) {
      summary.tool_call_savings += savings;
      summary.tool_call_entries += 1;
      continue;
    }

    if (isContextPackRecord(record)) {
      summary.context_pack_savings += savings;
      summary.context_pack_entries += 1;
      continue;
    }

    // If a record carries savings but does not match a dedicated bucket,
    // keep it visible as tool-call savings when the source looks proxy-ish;
    // otherwise treat it as context-pack style compression.
    const source = recordSource(record);
    if (source.includes('task') || source.includes('handoff')) {
      summary.context_pack_savings += savings;
      summary.context_pack_entries += 1;
    } else {
      summary.tool_call_savings += savings;
      summary.tool_call_entries += 1;
    }
  }

  return summary;
}

function taskStampTime(task) {
  return toMs(task.completed_at || task.updated_at || task.created_at || task.claimed_at);
}

function readTaskStamps(projectRoot, sinceMs) {
  const planningDir = path.join(projectRoot, '.planning');
  if (!taskFiles.hasTasksDir(planningDir)) return [];
  const tasks = taskFiles.listAll(planningDir);
  return tasks.filter((task) => {
    if (!sinceMs) return true;
    return taskStampTime(task) != null && taskStampTime(task) >= sinceMs;
  });
}

function estimateLocalRoutingSavings(tasks) {
  const byRuntime = Object.create(null);
  const bySkill = Object.create(null);
  let total = 0;
  let count = 0;

  for (const task of tasks) {
    const runtime = String(task.runtime || '').trim() || 'unknown';
    if (runtime === 'claude-code') continue;

    count += 1;
    const taskText = [
      task.goal,
      task.type,
      task.skill,
      task.keywords,
      Array.isArray(task.commands) ? task.commands.join(' ') : '',
      Array.isArray(task.files) ? task.files.join(' ') : '',
    ].filter(Boolean).join(' ').trim();

    const estimatedFrontierTokens = Math.max(
      DEFAULT_LOCAL_ROUTING_MIN_SAVINGS,
      Math.ceil(estimateTokens(taskText) * DEFAULT_LOCAL_ROUTING_MULTIPLIER),
    );

    total += estimatedFrontierTokens;
    byRuntime[runtime] = byRuntime[runtime] || { tasks: 0, tokens_saved: 0 };
    byRuntime[runtime].tasks += 1;
    byRuntime[runtime].tokens_saved += estimatedFrontierTokens;

    const skillKey = String(task.skill || task.type || 'unclassified').trim() || 'unclassified';
    bySkill[skillKey] = bySkill[skillKey] || { tasks: 0, tokens_saved: 0 };
    bySkill[skillKey].tasks += 1;
    bySkill[skillKey].tokens_saved += estimatedFrontierTokens;
  }

  return {
    count,
    tokens_saved: total,
    byRuntime,
    bySkill,
  };
}

function estimateContextPackSavings(projectRoot, sinceMs, records, projectid) {
  const fromRecords = summarizeRecords(records, sinceMs);
  if (fromRecords.context_pack_savings > 0) {
    return {
      tokens_saved: fromRecords.context_pack_savings,
      entries: fromRecords.context_pack_entries,
      estimated: false,
    };
  }

  const handoffs = listHandoffs({
    baseDir: projectRoot,
    bucket: 'all',
    projectid: projectid || undefined,
  }) || [];
  let handoffCount = 0;
  let estimatedBodyTokens = 0;

  for (const handoff of handoffs) {
    const ts = toMs(handoff.frontmatter && (handoff.frontmatter.created_at || handoff.frontmatter.updated_at || handoff.frontmatter.completed_at || handoff.frontmatter.claimed_at));
    if (sinceMs && ts != null && ts < sinceMs) continue;

    handoffCount += 1;
    try {
      const text = fs.readFileSync(handoff.filePath, 'utf8');
      const parsed = parseFrontmatter(text);
      const body = parsed && typeof parsed.body === 'string' ? parsed.body : '';
      estimatedBodyTokens += estimateTokens(body);
    } catch {
      estimatedBodyTokens += DEFAULT_CONTEXT_PACK_SAVINGS_PER_HANDOFF;
    }
  }

  const tokensSaved = handoffCount > 0
    ? Math.max(
        0,
        Math.round(estimatedBodyTokens * 0.18),
      )
    : 0;

  return {
    tokens_saved: tokensSaved || (handoffCount * DEFAULT_CONTEXT_PACK_SAVINGS_PER_HANDOFF),
    entries: handoffCount,
    estimated: true,
  };
}

function readFrontierRate(cachePath) {
  const cache = safeReadJson(cachePath);
  if (!cache || typeof cache !== 'object') return DEFAULT_FRONTIER_RATE_USD_PER_TOKEN;

  const sessionTokens = ensureNumber(cache.session && cache.session.tokens);
  const sessionUsd = ensureNumber(cache.session && cache.session.usd);
  if (sessionTokens && sessionUsd != null && sessionTokens > 0) {
    return sessionUsd / sessionTokens;
  }

  const allTimeTokens = ensureNumber(cache.allTime && cache.allTime.tokens);
  const allTimeUsd = ensureNumber(cache.allTime && cache.allTime.usd);
  if (allTimeTokens && allTimeUsd != null && allTimeTokens > 0) {
    return allTimeUsd / allTimeTokens;
  }

  return DEFAULT_FRONTIER_RATE_USD_PER_TOKEN;
}

function zeroReport({ projectRoot, since, projectid, sourcePaths }) {
  const nowIso = new Date().toISOString();
  return {
    projectRoot,
    projectid: projectid || null,
    period: {
      since: since ? toIso(since) : null,
      until: nowIso,
    },
    no_data: true,
    tool_call_savings: 0,
    context_pack_savings: 0,
    local_routing_savings: 0,
    total_tokens_saved: 0,
    session_cost_estimate: 0,
    attribution_breakdown: {
      by_kind: {},
      by_runtime: {},
      by_skill: {},
    },
    sources: sourcePaths || {},
  };
}

function computeSavings({ projectRoot, since, projectid } = {}) {
  const resolvedRoot = findRepoRoot(projectRoot || process.cwd());
  const sourcePaths = resolveLedgerFiles(resolvedRoot);
  const sinceIso = toIso(since);
  const sinceMs = since ? toMs(since) : null;
  const nowIso = new Date().toISOString();

  const ledgerRecords = loadSavingsRecords(sourcePaths.ledgerPath);
  const metricRecords = loadMetricsRecords(sourcePaths.metricsDir);
  const records = ledgerRecords.length > 0 ? ledgerRecords : metricRecords;

  if (!records.length) {
    return zeroReport({ projectRoot: resolvedRoot, since: sinceIso, projectid, sourcePaths });
  }

  const filteredRecords = records.filter((record) => matchesSince(record, sinceMs));
  const ledgerSummary = summarizeRecords(filteredRecords, sinceMs);
  const localTasks = readTaskStamps(resolvedRoot, sinceMs);
  const localRouting = estimateLocalRoutingSavings(localTasks);
  const contextPack = estimateContextPackSavings(resolvedRoot, sinceMs, filteredRecords, projectid);
  const frontierRate = readFrontierRate(sourcePaths.cachePath);

  const attributionByRuntime = Object.create(null);
  for (const [runtime, info] of Object.entries(localRouting.byRuntime)) {
    attributionByRuntime[runtime] = {
      tasks: info.tasks,
      tokens_saved: info.tokens_saved,
    };
  }

  const attributionBySkill = Object.create(null);
  for (const [skill, info] of Object.entries(localRouting.bySkill)) {
    attributionBySkill[skill] = {
      tasks: info.tasks,
      tokens_saved: info.tokens_saved,
    };
  }

  const toolCallSavings = ledgerSummary.tool_call_savings;
  const contextPackSavings = contextPack.tokens_saved;
  const localRoutingSavings = localRouting.tokens_saved;
  const totalTokensSaved = toolCallSavings + contextPackSavings + localRoutingSavings;

  const byKind = {
    tool_call: {
      tokens_saved: toolCallSavings,
      entries: ledgerSummary.tool_call_entries,
      estimated: false,
    },
    context_pack: {
      tokens_saved: contextPackSavings,
      entries: contextPack.entries,
      estimated: contextPack.estimated,
    },
    local_routing: {
      tokens_saved: localRoutingSavings,
      tasks: localRouting.count,
      estimated: true,
    },
  };

  return {
    projectRoot: resolvedRoot,
    projectid: projectid || null,
    period: {
      since: sinceIso,
      until: nowIso,
    },
    no_data: false,
    tool_call_savings: toolCallSavings,
    context_pack_savings: contextPackSavings,
    local_routing_savings: localRoutingSavings,
    total_tokens_saved: totalTokensSaved,
    session_cost_estimate: Number((totalTokensSaved * frontierRate).toFixed(6)),
    attribution_breakdown: {
      by_kind: byKind,
      by_runtime: attributionByRuntime,
      by_skill: attributionBySkill,
    },
    sources: {
      ...sourcePaths,
      ledger_records: ledgerRecords.length,
      metric_records: metricRecords.length,
      task_records: localTasks.length,
      frontier_rate_usd_per_token: frontierRate,
    },
  };
}

module.exports = {
  computeSavings,
  _private: {
    resolveLedgerFiles,
    loadSavingsRecords,
    loadMetricsRecords,
    estimateContextPackSavings,
    estimateLocalRoutingSavings,
    readFrontierRate,
    summarizeRecords,
  },
};
