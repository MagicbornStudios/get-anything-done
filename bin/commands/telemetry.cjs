'use strict';
/**
 * gad telemetry — read-only summary of local telemetry across sessions, calls, tasks, and handoffs.
 *
 * Sources:
 *   - .planning/.sessions/<id>/events.jsonl      (whiteboard)
 *   - .planning/.gad-log/*.jsonl                 (gad CLI log)
 *   - .planning/.trace-events.jsonl              (trace events)
 *   - .planning/team/workers/<worker>/log.jsonl  (worker loop log)
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

const SOURCE_STREAMS = ['whiteboard', 'gad-log', 'trace', 'worker-log'];
const CANONICAL_TASK_RE = /\b([A-Z]+-T-\d+-\d+)\b/;
const SHORT_TASK_RE = /\b(\d+-\d+)\b/;
const HANDOFF_RE = /\b(h-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-z0-9-]+-\d+)\b/i;
const TOKEN_VOLUME_BUCKETS = [
  { key: 'lt-1k', label: '<1K', min: 0, maxExclusive: 1000 },
  { key: '1k-10k', label: '1K-9.9K', min: 1000, maxExclusive: 10000 },
  { key: '10k-50k', label: '10K-49.9K', min: 10000, maxExclusive: 50000 },
  { key: '50k-200k', label: '50K-199.9K', min: 50000, maxExclusive: 200000 },
  { key: 'ge-200k', label: '>=200K', min: 200000, maxExclusive: Number.POSITIVE_INFINITY },
];
const ESTIMATED_COST_BUCKETS = [
  { key: 'lt-0.01', label: '<$0.01', min: 0, maxExclusive: 0.01 },
  { key: '0.01-0.10', label: '$0.01-$0.09', min: 0.01, maxExclusive: 0.1 },
  { key: '0.10-1.00', label: '$0.10-$0.99', min: 0.1, maxExclusive: 1 },
  { key: '1.00-5.00', label: '$1.00-$4.99', min: 1, maxExclusive: 5 },
  { key: 'ge-5.00', label: '>=$5.00', min: 5, maxExclusive: Number.POSITIVE_INFINITY },
];

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

function readText(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
}

function toMs(value) {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

function normalizeTaskId(value, projectid) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^[A-Z]+-T-\d+-\d+$/.test(text)) return text;
  if (/^\d+-\d+$/.test(text) && projectid) return `${String(projectid).toUpperCase()}-T-${text}`;
  return text;
}

function derivePhase(taskId, handoffId) {
  if (taskId) {
    const match = String(taskId).match(/-T-(\d+)-\d+$/);
    if (match) return match[1];
    const short = String(taskId).match(/^(\d+)-\d+$/);
    if (short) return short[1];
  }
  if (handoffId) {
    const match = String(handoffId).match(/-(\d+)$/);
    if (match) return match[1];
  }
  return null;
}

function extractProjectid(text) {
  if (!text) return null;
  const match = String(text).match(/--projectid\s+([a-z0-9-]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function extractHandoffId(text) {
  if (!text) return null;
  const match = String(text).match(HANDOFF_RE);
  return match ? match[1] : null;
}

function extractTaskId(text, projectid) {
  if (!text) return null;
  const value = String(text);
  const canonical = value.match(CANONICAL_TASK_RE);
  if (canonical) return normalizeTaskId(canonical[1], projectid);

  const explicitPatterns = [
    /\btasks?\s+(?:show|claim|stamp|update|release|promote)\s+(\d+-\d+)\b/i,
    /\btask[-_ ]id\s*[:= ]\s*(\d+-\d+)\b/i,
    /\btask[-_ ]id\s*[:= ]\s*([A-Z]+-T-\d+-\d+)\b/i,
  ];
  for (const pattern of explicitPatterns) {
    const match = value.match(pattern);
    if (match) return normalizeTaskId(match[1], projectid);
  }

  const shortMatch = value.match(/\b(?:phase\s+\d+\s+task|task)\s+(\d+-\d+)\b/i);
  if (shortMatch) return normalizeTaskId(shortMatch[1], projectid);
  const plainShort = value.match(SHORT_TASK_RE);
  if (plainShort && !value.includes('h-')) return normalizeTaskId(plainShort[1], projectid);
  return null;
}

function inferRuntime(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return null;
  if (text.includes('codex')) return 'codex-cli';
  if (text.includes('opencode')) return 'opencode';
  if (text.includes('cursor')) return 'cursor';
  if (text.includes('claude')) return 'claude-code';
  if (text.includes('gemini')) return 'gemini-cli';
  return null;
}

function normalizeTarget(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function normalizeNumeric(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function emptyTokens() {
  return {
    input: null,
    output: null,
    cache: { read: null, write: null },
  };
}

function extractTokensFromEntry(entry) {
  const tokens = emptyTokens();
  const nested = entry && typeof entry.tokens === 'object' ? entry.tokens : null;
  const usage = entry && typeof entry.usage === 'object' ? entry.usage : null;

  tokens.input = normalizeNumeric(
    entry && entry.tokens_input != null ? entry.tokens_input
      : entry && entry.input_tokens != null ? entry.input_tokens
        : usage && usage.input_tokens != null ? usage.input_tokens
          : usage && usage.prompt_tokens != null ? usage.prompt_tokens
            : nested && nested.input != null ? nested.input
              : null,
  );
  tokens.output = normalizeNumeric(
    entry && entry.tokens_output != null ? entry.tokens_output
      : entry && entry.output_tokens != null ? entry.output_tokens
        : usage && usage.output_tokens != null ? usage.output_tokens
          : usage && usage.completion_tokens != null ? usage.completion_tokens
            : nested && nested.output != null ? nested.output
              : null,
  );
  tokens.cache.read = normalizeNumeric(
    entry && entry.tokens_cache_read != null ? entry.tokens_cache_read
      : usage && usage.cache_read_tokens != null ? usage.cache_read_tokens
        : usage && usage.input_cached_tokens != null ? usage.input_cached_tokens
          : nested && nested.cache && nested.cache.read != null ? nested.cache.read
            : null,
  );
  tokens.cache.write = normalizeNumeric(
    entry && entry.tokens_cache_write != null ? entry.tokens_cache_write
      : usage && usage.cache_write_tokens != null ? usage.cache_write_tokens
        : nested && nested.cache && nested.cache.write != null ? nested.cache.write
          : null,
  );
  return tokens;
}

function hasReportedTokens(tokens) {
  if (!tokens) return false;
  return [tokens.input, tokens.output, tokens.cache && tokens.cache.read, tokens.cache && tokens.cache.write]
    .some((value) => Number.isFinite(value));
}

function totalKnownTokens(tokens) {
  if (!hasReportedTokens(tokens)) return null;
  return [tokens.input, tokens.output, tokens.cache && tokens.cache.read, tokens.cache && tokens.cache.write]
    .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function loadPricingSnapshot(baseDir) {
  const filePath = path.join(baseDir, '.planning', 'model-pricing-snapshot.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function buildPricingIndex(snapshot) {
  const index = new Map();
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.providers) return index;
  for (const [provider, providerConfig] of Object.entries(snapshot.providers)) {
    const models = Array.isArray(providerConfig && providerConfig.models) ? providerConfig.models : [];
    for (const model of models) {
      if (!model || !model.id) continue;
      index.set(String(model.id).toLowerCase(), {
        provider,
        id: model.id,
        input_per_m: normalizeNumeric(model.input_per_m),
        output_per_m: normalizeNumeric(model.output_per_m),
      });
    }
  }
  return index;
}

function bucketCounts(definitions) {
  return definitions.map((bucket) => ({ ...bucket, count: 0 }));
}

function placeInBucket(buckets, value) {
  const bucket = buckets.find((candidate) => value >= candidate.min && value < candidate.maxExclusive);
  if (bucket) bucket.count += 1;
}

function estimateUsd(tokens, pricing) {
  if (!pricing || !tokens) return null;
  const inputCost = Number.isFinite(tokens.input) && Number.isFinite(pricing.input_per_m)
    ? (tokens.input / 1000000) * pricing.input_per_m
    : 0;
  const outputCost = Number.isFinite(tokens.output) && Number.isFinite(pricing.output_per_m)
    ? (tokens.output / 1000000) * pricing.output_per_m
    : 0;
  return inputCost + outputCost;
}

function parseFrontmatterMd(filePath) {
  const text = readText(filePath);
  if (!text || !text.startsWith('---')) return null;
  const lines = text.split(/\r?\n/);
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[key] = value === 'null' ? null : value;
  }
  return data;
}

function discoverSessionFiles(baseDir) {
  const sessionsDir = path.join(baseDir, '.planning', '.sessions');
  const files = [];
  if (!fs.existsSync(sessionsDir)) return files;
  for (const entry of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const eventsFile = path.join(sessionsDir, entry.name, 'events.jsonl');
    if (fs.existsSync(eventsFile)) files.push(eventsFile);
  }
  return files;
}

function discoverGadLogFiles(baseDir) {
  const dir = path.join(baseDir, '.planning', '.gad-log');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(dir, name));
}

function discoverTraceFiles(baseDir) {
  const filePath = path.join(baseDir, '.planning', '.trace-events.jsonl');
  return fs.existsSync(filePath) ? [filePath] : [];
}

function discoverWorkerLogFiles(baseDir) {
  const workerRoot = path.join(baseDir, '.planning', 'team', 'workers');
  const files = [];
  if (!fs.existsSync(workerRoot)) return files;
  for (const entry of fs.readdirSync(workerRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const logPath = path.join(workerRoot, entry.name, 'log.jsonl');
    if (fs.existsSync(logPath)) files.push(logPath);
  }
  return files;
}

function buildHandoffIndex(planningDir) {
  const map = new Map();
  for (const bucket of ['open', 'claimed', 'closed']) {
    const dir = path.join(planningDir, 'handoffs', bucket);
    if (!fs.existsSync(dir)) continue;
    for (const fileName of fs.readdirSync(dir)) {
      if (!fileName.endsWith('.md')) continue;
      const filePath = path.join(dir, fileName);
      const frontmatter = parseFrontmatterMd(filePath);
      if (!frontmatter || !frontmatter.id) continue;
      const projectid = frontmatter.projectid ? String(frontmatter.projectid).toLowerCase() : null;
      const taskId = normalizeTaskId(frontmatter.task_id || null, projectid);
      map.set(frontmatter.id, {
        id: frontmatter.id,
        projectid,
        phase: frontmatter.phase ? String(frontmatter.phase) : derivePhase(taskId, frontmatter.id),
        task_id: taskId,
      });
    }
  }
  return map;
}

function sessionArtifactLineage(lines, projectid) {
  const byStep = new Map();
  for (const line of lines) {
    if (line.kind !== 'attribution-link' || !line.step_id) continue;
    const existing = byStep.get(line.step_id) || { artifacts: [], taskId: null, handoffId: null };
    if (line.artifact_id) existing.artifacts.push(line.artifact_id);
    if (line.artifact_kind === 'task-stamp') existing.taskId = normalizeTaskId(line.artifact_id, projectid);
    if (line.artifact_kind === 'handoff-complete') existing.handoffId = line.artifact_id;
    byStep.set(line.step_id, existing);
  }
  return byStep;
}

function parseSessionRecords(filePath, handoffIndex) {
  const lines = readJsonl(filePath);
  const sessionId = path.basename(path.dirname(filePath));
  const sessionStart = lines.find((entry) => entry.kind === 'session-start') || {};
  const projectid = sessionStart.projectid ? String(sessionStart.projectid).toLowerCase() : null;
  const claimedHandoff = sessionStart.claimed_handoff || null;
  const handoffMeta = claimedHandoff ? handoffIndex.get(claimedHandoff) : null;
  const artifactsByStep = sessionArtifactLineage(lines, projectid);
  const records = [];

  for (const entry of lines) {
    if (entry.kind !== 'tool-call') continue;
    const stepMeta = artifactsByStep.get(entry.step_id) || { artifacts: [], taskId: null, handoffId: null };
    const handoffId = claimedHandoff || stepMeta.handoffId || null;
    const indexed = handoffId ? handoffIndex.get(handoffId) : null;
    const taskId = stepMeta.taskId || (indexed ? indexed.task_id : null);
    const resolvedProjectid = projectid || (indexed ? indexed.projectid : null);
    records.push({
      ts: entry.ts || null,
      runtime: sessionStart.runtime || null,
      model: sessionStart.model_profile || null,
      duration_ms: Number.isFinite(entry.duration_ms) ? entry.duration_ms : null,
      success: typeof entry.ok === 'boolean' ? entry.ok : null,
      source_stream: 'whiteboard',
      tokens: extractTokensFromEntry(entry),
      task_id: taskId,
      handoff_id: handoffId,
      artifact_lineage: stepMeta.artifacts.slice(),
      session_id: entry.session_id || sessionId,
      projectid: resolvedProjectid,
      phase: (indexed && indexed.phase) || derivePhase(taskId, handoffId),
      tool: entry.tool || null,
      target: normalizeTarget(entry.target),
    });
  }

  return records;
}

function parseGadLogRecords(filePath, handoffIndex) {
  const lines = readJsonl(filePath);
  const records = [];
  for (const entry of lines) {
    if (entry.type !== 'tool_call' && !entry.cmd) continue;
    const text = [entry.cmd, entry.gad_command, entry.input_summary].filter(Boolean).join('\n');
    const projectid = extractProjectid(text);
    const handoffId = extractHandoffId(text);
    const indexed = handoffId ? handoffIndex.get(handoffId) : null;
    const taskId = extractTaskId(text, projectid || (indexed ? indexed.projectid : null)) || (indexed ? indexed.task_id : null);
    records.push({
      ts: entry.ts || null,
      runtime: (entry.runtime && entry.runtime.id) || inferRuntime(text) || null,
      model: (entry.runtime && entry.runtime.model) || null,
      duration_ms: Number.isFinite(entry.duration_ms) ? entry.duration_ms : null,
      success: typeof entry.success === 'boolean'
        ? entry.success
        : (typeof entry.exit === 'number' ? entry.exit === 0 : null),
      source_stream: 'gad-log',
      tokens: extractTokensFromEntry(entry),
      task_id: taskId,
      handoff_id: handoffId,
      artifact_lineage: [],
      session_id: entry.session_id || null,
      projectid: projectid || (indexed ? indexed.projectid : null),
      phase: (indexed && indexed.phase) || derivePhase(taskId, handoffId),
      tool: entry.tool || (entry.cmd ? String(entry.cmd).split(/\s+/)[0] : null),
      target: normalizeTarget(entry.input_summary || entry.cmd || entry.gad_command),
    });
  }
  return records;
}

function parseTraceRecords(filePath, handoffIndex) {
  const lines = readJsonl(filePath);
  const records = [];
  for (const entry of lines) {
    if (entry.type !== 'tool_use' && entry.type !== 'file_mutation') continue;
    const text = [
      entry.inputs && entry.inputs.command,
      entry.inputs && entry.inputs.file_path,
      entry.tool,
    ].filter(Boolean).join('\n');
    const runtime = (entry.runtime && entry.runtime.id) || inferRuntime(text) || null;
    const projectid = extractProjectid(text);
    const handoffId = extractHandoffId(text);
    const indexed = handoffId ? handoffIndex.get(handoffId) : null;
    const taskId = extractTaskId(text, projectid || (indexed ? indexed.projectid : null)) || (indexed ? indexed.task_id : null);
    records.push({
      ts: entry.ts || null,
      runtime,
      model: (entry.runtime && entry.runtime.model) || (entry.agent && entry.agent.resolved_model) || null,
      duration_ms: Number.isFinite(entry.duration_ms) ? entry.duration_ms : null,
      success: typeof entry.success === 'boolean' ? entry.success : null,
      source_stream: 'trace',
      tokens: extractTokensFromEntry(entry),
      task_id: taskId,
      handoff_id: handoffId,
      artifact_lineage: [],
      session_id: entry.session_id || (entry.runtime && entry.runtime.session_id) || null,
      projectid: projectid || (indexed ? indexed.projectid : null),
      phase: (indexed && indexed.phase) || derivePhase(taskId, handoffId),
      tool: entry.tool || null,
      target: normalizeTarget((entry.inputs && (entry.inputs.command || entry.inputs.file_path)) || null),
    });
  }
  return records;
}

function parseWorkerRecords(filePath, handoffIndex) {
  const lines = readJsonl(filePath);
  const workerDefaults = new Map();
  const records = [];

  for (const entry of lines) {
    if (entry.kind === 'worker-start' && entry.worker_id) {
      workerDefaults.set(entry.worker_id, entry.runtime || inferRuntime(entry.runtime_cmd));
      continue;
    }

    if (!['work-complete', 'runtime-rate-limit-on-call', 'self-claim-error'].includes(entry.kind)) continue;

    const handoffId = entry.ref || null;
    const indexed = handoffId ? handoffIndex.get(handoffId) : null;
    const runtime = entry.runtime || inferRuntime(entry.runtime_cmd) || workerDefaults.get(entry.worker_id) || null;
    let success = null;
    if (entry.kind === 'work-complete' && typeof entry.exit_code === 'number') success = entry.exit_code === 0;
    if (entry.kind === 'runtime-rate-limit-on-call') success = false;
    if (entry.kind === 'self-claim-error') success = false;

    records.push({
      ts: entry.ts || null,
      runtime,
      model: null,
      duration_ms: Number.isFinite(entry.duration_ms) ? entry.duration_ms : null,
      success,
      source_stream: 'worker-log',
      tokens: extractTokensFromEntry(entry),
      task_id: indexed ? indexed.task_id : null,
      handoff_id: handoffId,
      artifact_lineage: [],
      session_id: null,
      projectid: indexed ? indexed.projectid : null,
      phase: (indexed && indexed.phase) || derivePhase(indexed ? indexed.task_id : null, handoffId),
      tool: entry.kind === 'runtime-rate-limit-on-call' ? 'rate-limit' : 'handoff',
      target: normalizeTarget(handoffId || entry.kind),
    });
  }

  return records;
}

function nearestWhiteboardRecord(record, whiteboardRecords) {
  if (!record.runtime || !record.ts) return null;
  const targetMs = toMs(record.ts);
  if (targetMs == null) return null;
  let best = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const candidate of whiteboardRecords) {
    if (candidate.runtime !== record.runtime || !candidate.ts) continue;
    const delta = Math.abs(targetMs - toMs(candidate.ts));
    if (delta > 5000 || delta >= bestDelta) continue;
    best = candidate;
    bestDelta = delta;
  }
  return best;
}

function augmentWithWhiteboardContext(records) {
  const whiteboardRecords = records.filter((record) => record.source_stream === 'whiteboard');
  if (whiteboardRecords.length === 0) return records;
  return records.map((record) => {
    if (record.source_stream === 'whiteboard') return record;
    const matched = nearestWhiteboardRecord(record, whiteboardRecords);
    if (!matched) return record;
    return {
      ...record,
      projectid: record.projectid || matched.projectid || null,
      task_id: record.task_id || matched.task_id || null,
      handoff_id: record.handoff_id || matched.handoff_id || null,
      artifact_lineage: record.artifact_lineage.length > 0 ? record.artifact_lineage : matched.artifact_lineage.slice(),
      model: record.model || matched.model || null,
      phase: record.phase || matched.phase || null,
    };
  });
}

function resolveBaseDir(args, findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid) {
  const repoRoot = findRepoRoot();
  const config = gadConfig.load(repoRoot);
  const activeProject = getLastActiveProjectid ? getLastActiveProjectid() : '';
  const projectid = args.projectid || activeProject || '';
  const roots = resolveRoots({ projectid }, repoRoot, config.roots);
  const root = roots[0];
  if (!root) return repoRoot;
  return path.join(repoRoot, root.path);
}

function collectTelemetryRecords(baseDir) {
  const planningDir = path.join(baseDir, '.planning');
  const handoffIndex = buildHandoffIndex(planningDir);
  const records = [];

  for (const filePath of discoverSessionFiles(baseDir)) {
    records.push(...parseSessionRecords(filePath, handoffIndex));
  }
  for (const filePath of discoverGadLogFiles(baseDir)) {
    records.push(...parseGadLogRecords(filePath, handoffIndex));
  }
  for (const filePath of discoverTraceFiles(baseDir)) {
    records.push(...parseTraceRecords(filePath, handoffIndex));
  }
  for (const filePath of discoverWorkerLogFiles(baseDir)) {
    records.push(...parseWorkerRecords(filePath, handoffIndex));
  }

  return augmentWithWhiteboardContext(records).map((record) => ({
    ...record,
    phase: record.phase || derivePhase(record.task_id, record.handoff_id),
  }));
}

function matchesTaskFilter(recordTaskId, filter, projectid) {
  if (!recordTaskId || !filter) return false;
  const normalized = normalizeTaskId(filter, projectid);
  return recordTaskId === normalized || recordTaskId.endsWith(`-T-${filter}`);
}

function applyFilters(records, filters) {
  return records.filter((record) => {
    if (filters.since) {
      const sinceMs = toMs(filters.since);
      const recordMs = toMs(record.ts);
      if (sinceMs != null && (recordMs == null || recordMs < sinceMs)) return false;
    }
    if (filters.projectid && record.projectid !== filters.projectid) return false;
    if (filters.session && (!record.session_id || !String(record.session_id).includes(filters.session))) return false;
    if (filters.runtime && (!record.runtime || !String(record.runtime).includes(filters.runtime))) return false;
    if (filters.phase && String(record.phase || '') !== String(filters.phase)) return false;
    if (filters.handoff && record.handoff_id !== filters.handoff) return false;
    if (filters.task && !matchesTaskFilter(record.task_id, filters.task, record.projectid || filters.projectid || null)) return false;
    return true;
  });
}

function buildHistogramSummary(records, pricingSnapshot) {
  const pricingIndex = buildPricingIndex(pricingSnapshot);
  const tokenBuckets = bucketCounts(TOKEN_VOLUME_BUCKETS);
  const costBuckets = bucketCounts(ESTIMATED_COST_BUCKETS);
  const modelsSeen = new Set();
  const modelsPriced = new Set();
  const modelsMissingPricing = new Set();
  let recordsWithReportedTokens = 0;
  let recordsMissingTokenUsage = 0;
  let recordsMissingPricing = 0;
  let totalKnownTokensAcrossRecords = 0;
  let totalEstimatedUsd = 0;
  const estimatedCalls = [];

  for (const record of records) {
    if (!hasReportedTokens(record.tokens)) {
      recordsMissingTokenUsage += 1;
      continue;
    }

    recordsWithReportedTokens += 1;
    const totalTokens = totalKnownTokens(record.tokens);
    if (Number.isFinite(totalTokens)) {
      totalKnownTokensAcrossRecords += totalTokens;
      placeInBucket(tokenBuckets, totalTokens);
    }

    const normalizedModel = record.model ? String(record.model).toLowerCase() : '';
    if (!normalizedModel) {
      recordsMissingPricing += 1;
      continue;
    }
    modelsSeen.add(normalizedModel);

    const pricing = pricingIndex.get(normalizedModel);
    if (!pricing) {
      recordsMissingPricing += 1;
      modelsMissingPricing.add(normalizedModel);
      continue;
    }
    modelsPriced.add(normalizedModel);

    const estimatedUsd = estimateUsd(record.tokens, pricing);
    totalEstimatedUsd += estimatedUsd;
    placeInBucket(costBuckets, estimatedUsd);
    estimatedCalls.push({
      ts: record.ts,
      runtime: record.runtime,
      model: record.model,
      source_stream: record.source_stream,
      estimated_usd: Math.round(estimatedUsd * 1000000) / 1000000,
      total_tokens: totalTokens,
      task_id: record.task_id,
      handoff_id: record.handoff_id,
    });
  }

  estimatedCalls.sort((a, b) => b.estimated_usd - a.estimated_usd);
  return {
    snapshotGeneratedAt: pricingSnapshot && pricingSnapshot.generated_at ? pricingSnapshot.generated_at : null,
    dependencyNote: 'Phase 106 consumes these local histograms to build budget baselines and claim-time cost prediction.',
    tokenVolumeBuckets: tokenBuckets,
    estimatedUsdBuckets: costBuckets,
    recordsWithReportedTokens,
    recordsMissingTokenUsage,
    recordsMissingPricing,
    totalKnownTokensAcrossRecords,
    totalEstimatedUsd: Math.round(totalEstimatedUsd * 1000000) / 1000000,
    modelsSeen: Array.from(modelsSeen).sort(),
    pricedModels: Array.from(modelsPriced).sort(),
    missingPricingModels: Array.from(modelsMissingPricing).sort(),
    topEstimatedCalls: estimatedCalls.slice(0, 10),
    fallbackPolicy: {
      missingTokenUsage: 'Records with duration/success but no token fields remain unestimated and are counted separately.',
      missingPricing: 'Records with token usage but no matching model in .planning/model-pricing-snapshot.json remain unestimated and are counted separately.',
      tokenSynthesis: 'Token values are never synthesized from duration or success signals.',
    },
  };
}

function summarizeRecords(records, filters, options = {}) {
  const totalCalls = records.length;
  const successCount = records.filter((record) => record.success === true).length;
  const failureCount = records.filter((record) => record.success === false).length;
  const unknownCount = totalCalls - successCount - failureCount;
  const durationRecords = records.filter((record) => Number.isFinite(record.duration_ms));
  const totalDuration = durationRecords.reduce((sum, record) => sum + record.duration_ms, 0);
  const slowestCalls = durationRecords
    .slice()
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 10)
    .map((record) => ({
      ts: record.ts,
      source_stream: record.source_stream,
      runtime: record.runtime,
      tool: record.tool,
      target: record.target,
      duration_ms: record.duration_ms,
      task_id: record.task_id,
      handoff_id: record.handoff_id,
    }));

  const attributedRecords = records.filter((record) => record.task_id || record.handoff_id || record.artifact_lineage.length > 0).length;
  const attributionCoverage = totalCalls === 0 ? 0 : Math.round((attributedRecords / totalCalls) * 10000) / 100;
  const perSource = Object.fromEntries(SOURCE_STREAMS.map((source) => {
    const subset = records.filter((record) => record.source_stream === source);
    return [source, {
      count: subset.length,
      success: subset.filter((record) => record.success === true).length,
      failure: subset.filter((record) => record.success === false).length,
      unknown: subset.filter((record) => record.success == null).length,
      total_duration_ms: subset.reduce((sum, record) => sum + (Number.isFinite(record.duration_ms) ? record.duration_ms : 0), 0),
    }];
  }));
  const sourceCoverageGaps = SOURCE_STREAMS.filter((source) => perSource[source].count === 0);

  const coverageGaps = {
    source_streams: sourceCoverageGaps,
    missing_projectid: records.filter((record) => !record.projectid).length,
    missing_task_id: records.filter((record) => !record.task_id).length,
    missing_handoff_id: records.filter((record) => !record.handoff_id).length,
    missing_runtime: records.filter((record) => !record.runtime).length,
    missing_duration_ms: records.filter((record) => !Number.isFinite(record.duration_ms)).length,
  };
  const histograms = buildHistogramSummary(records, options.pricingSnapshot || null);

  return {
    filters,
    totalCalls,
    successCount,
    failureCount,
    unknownCount,
    totalDuration,
    avgDuration: durationRecords.length === 0 ? 0 : Math.round(totalDuration / durationRecords.length),
    slowestCalls,
    attributedRecords,
    attributionCoverage,
    perSource,
    coverageGaps,
    histograms,
  };
}

function printHumanSummary(summary) {
  console.log('\n=== Telemetry Summary ===\n');
  console.log(`Total calls:          ${summary.totalCalls}`);
  console.log(`Success / failure:    ${summary.successCount} / ${summary.failureCount}`);
  console.log(`Unknown success:      ${summary.unknownCount}`);
  console.log(`Total duration:       ${summary.totalDuration}ms`);
  console.log(`Average duration:     ${summary.avgDuration}ms`);
  console.log(`Attribution coverage: ${summary.attributedRecords} records (${summary.attributionCoverage}%)`);
  console.log('');
  console.log('Per source:');
  for (const source of SOURCE_STREAMS) {
    const row = summary.perSource[source];
    const gap = row.count === 0 ? '  (NO DATA)' : '';
    console.log(`  ${source.padEnd(10)} ${String(row.count).padStart(5)} records  ${row.success} ok / ${row.failure} fail / ${row.unknown} unknown  ${row.total_duration_ms}ms${gap}`);
  }
  console.log('');
  if (summary.coverageGaps.source_streams.length > 0) {
    console.log(`Source coverage gaps: ${summary.coverageGaps.source_streams.join(', ')}`);
  }
  console.log(`Missing lineage:      project=${summary.coverageGaps.missing_projectid}, task=${summary.coverageGaps.missing_task_id}, handoff=${summary.coverageGaps.missing_handoff_id}`);
  console.log(`Missing runtime/dur:  runtime=${summary.coverageGaps.missing_runtime}, duration=${summary.coverageGaps.missing_duration_ms}`);
  console.log(`Token usage reported: ${summary.histograms.recordsWithReportedTokens}`);
  console.log(`Missing token usage:  ${summary.histograms.recordsMissingTokenUsage}`);
  console.log(`Missing pricing:      ${summary.histograms.recordsMissingPricing}`);
  console.log(`Estimated USD total:  $${summary.histograms.totalEstimatedUsd.toFixed(6)}`);
  console.log(`Phase 106 link:       ${summary.histograms.dependencyNote}`);
  console.log('');
  console.log('Token-volume buckets:');
  summary.histograms.tokenVolumeBuckets.forEach((bucket) => {
    console.log(`  ${bucket.label.padEnd(11)} ${bucket.count}`);
  });
  console.log('Estimated-cost buckets:');
  summary.histograms.estimatedUsdBuckets.forEach((bucket) => {
    console.log(`  ${bucket.label.padEnd(11)} ${bucket.count}`);
  });
  if (summary.slowestCalls.length > 0) {
    console.log('\nSlowest calls:');
    summary.slowestCalls.forEach((record, index) => {
      const target = normalizeTarget(record.target || '') || '';
      console.log(`  ${(index + 1).toString().padStart(2)}. ${String(record.tool || '?').padEnd(12)} ${String(record.duration_ms).padStart(8)}ms  [${record.source_stream}]  ${target.slice(0, 80)}`);
    });
  }
}

function createTelemetryCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  const summaryCmd = defineCommand({
    meta: { name: 'summary', description: 'Summarize local telemetry across sessions, calls, tasks, and handoffs.' },
    args: {
      projectid: { type: 'string', description: 'Filter by project id', default: '' },
      session: { type: 'string', description: 'Filter by whiteboard/trace session id', default: '' },
      runtime: { type: 'string', description: 'Filter by runtime id', default: '' },
      phase: { type: 'string', description: 'Filter by phase number', default: '' },
      task: { type: 'string', description: 'Filter by task id (89-06 or GLOBAL-T-89-06)', default: '' },
      handoff: { type: 'string', description: 'Filter by handoff id', default: '' },
      since: { type: 'string', description: 'Only include records at or after this ISO timestamp', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(args, findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid);
      const planningDir = path.join(baseDir, '.planning');
      if (!fs.existsSync(planningDir)) {
        outputError(`No .planning directory under ${baseDir}`);
        return;
      }

      const filters = {
        projectid: args.projectid ? String(args.projectid).toLowerCase() : '',
        session: args.session || '',
        runtime: args.runtime || '',
        phase: args.phase || '',
        task: args.task || '',
        handoff: args.handoff || '',
        since: args.since || '',
      };

      const records = applyFilters(collectTelemetryRecords(baseDir), filters);
      const summary = summarizeRecords(records, filters, { pricingSnapshot: loadPricingSnapshot(baseDir) });
      if (args.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printHumanSummary(summary);
      }
    },
  });

  const exportCmd = defineCommand({
    meta: {
      name: 'export',
      description: 'Export unified telemetry envelopes (phase 145) for SLM training. Walks all 4 source adapters, dedups by envelope id, writes events.jsonl + MANIFEST.json (with sha256).',
    },
    args: {
      to: { type: 'string', description: 'Output directory (created if missing)', required: true },
      since: { type: 'string', description: 'ISO timestamp (e.g. 2026-05-01T00:00:00Z); rows older are skipped' },
      format: { type: 'string', description: 'jsonl | parquet | duckdb (default jsonl). parquet/duckdb fall back to jsonl until T-145-05.' },
      projectid: { type: 'string', description: 'Reserved — adapter-side project filtering ships in v2' },
      adapters: { type: 'string', description: 'Comma-separated adapter subset: gad-log,trace-events,worker-log,prompt-files. Default: all.' },
      'root-dir': { type: 'string', description: 'Monorepo root (defaults to cwd ascended to nearest .planning/)' },
      json: { type: 'boolean', description: 'Output result summary as JSON' },
      'no-redact': { type: 'boolean', description: 'Disable secret redaction (DEFAULT: redact ON for safety per phase 145.5-06).' },
      watch: { type: 'boolean', description: 'Long-running mode: re-export every --interval' },
      interval: { type: 'string', description: 'Interval (e.g. 30s, 5m, 1h). Default 30s. If watch is on, exports to subdirs.' },
    },
    run: async ({ args }) => {
      const { runExport } = require('../../lib/telemetry/export.cjs');
      const rootDir = args['root-dir'] || (function findRoot() {
        let d = process.cwd();
        while (d !== path.dirname(d)) {
          if (fs.existsSync(path.join(d, '.planning'))) return d;
          d = path.dirname(d);
        }
        return process.cwd();
      })();
      const adapters = args.adapters ? args.adapters.split(',').map((s) => s.trim()).filter(Boolean) : null;

      function parseInterval(s) {
        if (!s) return 30000;
        const m = s.match(/^(\d+)([smh])$/);
        if (!m) return 30000;
        const val = parseInt(m[1], 10);
        const unit = m[2];
        if (unit === 's') return val * 1000;
        if (unit === 'm') return val * 60 * 1000;
        if (unit === 'h') return val * 60 * 60 * 1000;
        return 30000;
      }

      const intervalMs = parseInterval(args.interval);
      const isWatch = Boolean(args.watch);

      const doExport = async (outDirOverride) => {
        return runExport({
          rootDir,
          outDir: outDirOverride || args.to,
          since: args.since || null,
          format: args.format || 'jsonl',
          adapters,
          redact: !args['no-redact'],
        });
      };

      if (!isWatch) {
        const result = await doExport();
        if (args.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('Telemetry export complete');
          console.log(`  rootDir:    ${result.rootDir}`);
          console.log(`  outDir:     ${result.outDir}`);
          console.log(`  data:       ${result.dataPath}`);
          console.log(`  manifest:   ${result.manifestPath}`);
          console.log(`  rows:       ${result.rowCount}`);
          console.log(`  by role:    ${Object.entries(result.roleHistogram).map(([k, v]) => `${k}=${v}`).join('  ')}`);
          if (result.contentTypeHistogram) {
            console.log(`  by ctype:   ${Object.entries(result.contentTypeHistogram).map(([k, v]) => `${k}=${v}`).join('  ')}`);
          }
          console.log(`  schema_v:   ${result.manifest.schema_v}`);
          console.log(`  sha256:     ${result.manifest.data_sha256}`);
        }
        return;
      }

      // Watch mode
      console.log(`[telemetry export] watch mode ON. interval=${intervalMs}ms. root=${rootDir}`);
      while (true) {
        const now = new Date();
        const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const outDir = path.join(args.to, stamp);
        console.log(`[telemetry export] starting export to ${outDir} ...`);
        try {
          const result = await doExport(outDir);
          console.log(`[telemetry export] done. rows=${result.rowCount} sha=${result.manifest.data_sha256.slice(0, 8)}`);
        } catch (e) {
          console.error(`[telemetry export] FAILED: ${e.message}`);
        }
        await new Promise((res) => setTimeout(res, intervalMs));
      }
    },
  });

  // ── gad telemetry models ─────────────────────────────────────────────────
  // Model-keyed rollup from existing telemetry sources + slm-learning registry.
  // Decision GLOBAL-D-317. Helpers extracted to lib/telemetry/model-rollup.cjs
  // for reuse in snapshot HEALTH section.
  // ─────────────────────────────────────────────────────────────────────────

  const {
    loadSlmRegistry,
    loadDeltaGraph,
    resolveSlmModelsDir,
    buildSlmIndex,
    buildModelRollup,
    mergeSlmZeroRows,
    relativeTime,
  } = require('../../lib/telemetry/model-rollup.cjs');

  function printModelsTable(rows, noModelIdCount, windowH) {
    console.log(`\n=== Telemetry: Model Rollup (last ${windowH}h) ===\n`);

    if (noModelIdCount > 0) {
      console.log(`NOTE: ${noModelIdCount} call(s) have no model_id — grouped as (unknown-model) per runtime.`);
      console.log('      Extend adapters per task GAD-T-35-01 to populate model_id.\n');
    }

    const COL = {
      MODEL:     40,
      SOURCE:    10,
      VERSION:   20,
      CALLS:      7,
      P50_MS:     9,
      LAST_SEEN: 12,
      RUNTIME:   14,
      RECIPE:    10,
    };

    const header = [
      'MODEL'.padEnd(COL.MODEL),
      'SOURCE'.padEnd(COL.SOURCE),
      'VERSION'.padEnd(COL.VERSION),
      'CALLS'.padStart(COL.CALLS),
      'P50_MS'.padStart(COL.P50_MS),
      'LAST_SEEN'.padEnd(COL.LAST_SEEN),
      'RUNTIME'.padEnd(COL.RUNTIME),
      'RECIPE'.padEnd(COL.RECIPE),
    ].join('  ');

    const sep = '─'.repeat(header.length);
    console.log(header);
    console.log(sep);

    for (const row of rows) {
      const model = row.model.length > COL.MODEL ? row.model.slice(0, COL.MODEL - 1) + '…' : row.model;
      const version = (row.version || '-').slice(0, COL.VERSION);
      const lastSeen = relativeTime(row.last_seen);
      const runtime = (row.runtime || '-').slice(0, COL.RUNTIME - 1);
      const recipe = (row.recipe || '-').slice(0, COL.RECIPE - 1);

      console.log([
        model.padEnd(COL.MODEL),
        (row.source || '-').padEnd(COL.SOURCE),
        version.padEnd(COL.VERSION),
        String(row.calls).padStart(COL.CALLS),
        (row.p50_ms != null ? String(row.p50_ms) : '-').padStart(COL.P50_MS),
        lastSeen.padEnd(COL.LAST_SEEN),
        runtime.padEnd(COL.RUNTIME),
        recipe.padEnd(COL.RECIPE),
      ].join('  '));
    }

    console.log('');
    console.log(`Rows: ${rows.length}  (SLM models with 0 calls are included from slm-learning REGISTRY if path exists)`);
  }

  const modelsCmd = defineCommand({
    meta: {
      name: 'models',
      description: 'Model-keyed telemetry rollup — calls/latency/last-seen per model+runtime, cross-linked to slm-learning REGISTRY + DELTA_GRAPH. GLOBAL-D-317.',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to a project (default: all)', default: '' },
      'window-h': { type: 'string', description: 'Time window in hours (default: 24)', default: '24' },
      top: { type: 'string', description: 'Limit to top N rows by calls (default: 20, 0=all)', default: '20' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
      'include-slm-learning': { type: 'boolean', description: 'Pull REGISTRY/DELTA_GRAPH from sibling slm_learning repo (default: true if path exists)', default: true },
      'no-include-slm-learning': { type: 'boolean', description: 'Disable slm-learning integration', default: false },
    },
    run({ args }) {
      const baseDir = resolveBaseDir(args, findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid);
      const repoRoot = findRepoRoot();
      const planningDir = path.join(baseDir, '.planning');
      if (!fs.existsSync(planningDir)) {
        outputError(`No .planning directory under ${baseDir}`);
        return;
      }

      const windowH = Math.max(1, parseFloat(args['window-h']) || 24);
      const windowMs = windowH * 60 * 60 * 1000;
      const topN = parseInt(args.top, 10);
      const includeSlm = args['no-include-slm-learning'] ? false : args['include-slm-learning'];

      const filters = {
        projectid: args.projectid ? String(args.projectid).toLowerCase() : '',
        session: '',
        runtime: '',
        phase: '',
        task: '',
        handoff: '',
        since: '',
      };

      const allRecords = applyFilters(collectTelemetryRecords(baseDir), filters);

      // Load slm-learning data
      let slmIndex = new Map();
      let slmLoaded = false;
      if (includeSlm) {
        const slmDir = resolveSlmModelsDir(repoRoot);
        if (slmDir) {
          const registry = loadSlmRegistry(slmDir);
          const deltaGraph = loadDeltaGraph(slmDir);
          slmIndex = buildSlmIndex(registry, deltaGraph);
          slmLoaded = true;
        }
      }

      // Build rollup
      let rows = buildModelRollup(allRecords, windowMs, slmIndex);

      // Merge in slm models with 0 calls
      if (slmLoaded && slmIndex.size > 0) {
        rows = mergeSlmZeroRows(rows, slmIndex, windowMs);
      }

      // Sort: calls desc, then model asc
      rows.sort((a, b) => b.calls - a.calls || a.model.localeCompare(b.model));

      // Count no-model records
      const noModelIdCount = allRecords.filter((r) => !r.model).length;

      // Apply top limit (after including 0-call SLM rows, those naturally sort to bottom)
      const limited = topN > 0 ? rows.slice(0, topN) : rows;

      if (args.json) {
        console.log(JSON.stringify({
          window_h: windowH,
          generated_at: new Date().toISOString(),
          no_model_id_count: noModelIdCount,
          slm_learning_loaded: slmLoaded,
          total_rows: rows.length,
          rows: limited,
        }, null, 2));
      } else {
        printModelsTable(limited, noModelIdCount, windowH);
      }
    },
  });

  return defineCommand({
    meta: { name: 'telemetry', description: 'Telemetry: summary (read-only) + export (phase 145 SLM training pipeline) + models (model-keyed rollup, GLOBAL-D-317).' },
    subCommands: {
      summary: summaryCmd,
      export: exportCmd,
      models: modelsCmd,
    },
  });
}

module.exports = { createTelemetryCommand };
module.exports.register = (ctx) => ({ telemetry: createTelemetryCommand(ctx.common) });
module.exports._private = {
  collectTelemetryRecords,
  applyFilters,
  summarizeRecords,
  buildHistogramSummary,
  loadPricingSnapshot,
  extractTokensFromEntry,
  hasReportedTokens,
  totalKnownTokens,
  buildHandoffIndex,
  normalizeTaskId,
  derivePhase,
  extractProjectid,
  extractTaskId,
  extractHandoffId,
};
