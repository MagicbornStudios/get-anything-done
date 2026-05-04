'use strict';
/**
 * gad telemetry — read-only summary of local telemetry across sessions, calls, tasks, and handoffs.
 *
 * Sources:
 *   - .planning/.sessions/<id>/events.jsonl      (whiteboard)
 *   - .planning/.gad-log/*.jsonl                 (gad CLI log)
 *   - .planning/.trace-events.jsonl              (trace events)
 *   - .planning/team/workers/*/log.jsonl         (worker loop log)
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

const SOURCE_STREAMS = ['whiteboard', 'gad-log', 'trace', 'worker-log'];
const PHASE_TASK_RE = /\b([A-Z]+-T-\d+-\d+|\d+-\d+)\b/g;
const HANDOFF_RE = /\b(h-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-z0-9-]+-\d+)\b/i;

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
  const matches = Array.from(String(text).matchAll(PHASE_TASK_RE));
  if (matches.length === 0) return null;
  return normalizeTaskId(matches[0][1], projectid);
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

function emptyTokens() {
  return {
    input: null,
    output: null,
    cache: { read: null, write: null },
  };
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
      tokens: emptyTokens(),
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
      tokens: emptyTokens(),
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
      tokens: emptyTokens(),
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
      tokens: emptyTokens(),
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

function summarizeRecords(records, filters) {
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
      const summary = summarizeRecords(records, filters);
      if (args.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printHumanSummary(summary);
      }
    },
  });

  return defineCommand({
    meta: { name: 'telemetry', description: 'Read-only telemetry summary across sessions, calls, tasks, and handoffs.' },
    subCommands: {
      summary: summaryCmd,
    },
  });
}

module.exports = { createTelemetryCommand };
module.exports.register = (ctx) => ({ telemetry: createTelemetryCommand(ctx.common) });
module.exports._private = {
  collectTelemetryRecords,
  applyFilters,
  summarizeRecords,
  buildHandoffIndex,
  normalizeTaskId,
  derivePhase,
  extractProjectid,
  extractTaskId,
  extractHandoffId,
};
