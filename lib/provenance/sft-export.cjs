'use strict';
/**
 * lib/provenance/sft-export.cjs — SFT (Supervised Fine-Tuning) corpus builder.
 *
 * Converts enriched+labeled provenance events into training tuples shaped for
 * a coding model. Output grouped by runtime / task-type / date.
 *
 * Tuple shape:
 *   {
 *     system_prompt:      string,
 *     user_prompt:        string,
 *     tool_calls?:        object[],
 *     tool_results?:      object[],
 *     assistant_response: string,
 *     meta: {
 *       runtime:    string|null,
 *       model:      string|null,
 *       handoff_id: string|null,
 *       task_id:    string|null,
 *       phase:      string|number|null,
 *       label:      "good"|"mid"|"bad"|"unknown",
 *       quality:    number,          // 0..1 numeric score
 *       task_type:  string,          // code-edit|planning|debug|review|test-write|other
 *       event_id:   string|null,
 *       file_path:  string|null,
 *       ts:         string|null,
 *     }
 *   }
 *
 * Quality heuristic (GLOBAL-D-302 extension):
 *   good    — code shipped + survived ≥ 7 days untouched  (score ≥ 0.80)
 *   mid     — shipped + edited within 7d but not reverted  (score 0.40..0.79)
 *   bad     — reverted OR churn > 50% within 7d            (score < 0.40)
 *   unknown — too new to score (< 24h)                     (score 0)
 *
 * Decision refs: GLOBAL-D-300..305, Phase 153.
 */

const fs = require('node:fs');
const path = require('node:path');
const { readJsonl, provenanceDir, parseDateRange, ymd } = require('./index.cjs');
const { buildProvenance } = require('./join.cjs');
const { buildWorkerProvenance } = require('./worker-join.cjs');
const { annotateSurvival } = require('./survival.cjs');
const { annotateFrequency } = require('./frequency.cjs');
const { annotateLabels } = require('./label.cjs');

// ──────────────────────────────────────────────
// Task-type classification
// ──────────────────────────────────────────────

const TASK_TYPE_PATTERNS = {
  'test-write': [
    /\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /\.test\.cjs$/, /\.spec\.cjs$/,
    /^tests?\//i, /\/__tests__\//i,
  ],
  'review': [
    /REVIEW/i, /code.?review/i,
  ],
  'debug': [
    /debug/i, /fix/i, /patch/i, /hotfix/i, /bugfix/i,
  ],
  'planning': [
    /\.planning\//, /\.md$/, /TASK-REGISTRY/, /DECISIONS\.xml/i,
    /handoffs\//, /phases\//, /decisions\//,
  ],
};

/**
 * Classify an enriched event into a training task type.
 * Inspect file path + task skill + handoff body hints.
 *
 * @param {object} evt — enriched provenance event
 * @returns {string} task type: code-edit|planning|debug|review|test-write|other
 */
function classifyTaskType(evt) {
  const filePath = evt.file_path || '';
  const skill = (evt.task && evt.task.skill) || '';
  const combined = `${filePath}|${skill}`.toLowerCase();

  for (const [taskType, patterns] of Object.entries(TASK_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(combined)) return taskType;
    }
  }

  // Code-edit is the default for actual code file modifications
  const codeExts = /\.(js|ts|jsx|tsx|cjs|mjs|py|go|rs|rb|java|c|cpp|h|hpp|cs|swift|kt)$/i;
  if (codeExts.test(filePath)) return 'code-edit';

  return 'other';
}

// ──────────────────────────────────────────────
// Quality scoring
// ──────────────────────────────────────────────

/**
 * Compute a quality label + numeric score for an enriched event.
 *
 * @param {object} opts
 * @param {object} opts.joinedEvent    — enriched provenance event (with label/survival/frequency)
 * @param {string} [opts.projectRoot]  — repo root (unused in v1, reserved for git regression hook)
 * @param {number} [opts.daysSinceShip] — override for testing (default: computed from evt.ts)
 * @returns {{ label: string, score: number, reason: string }}
 */
function scoreQuality({ joinedEvent: evt, daysSinceShip }) {
  const survival = evt.survival || {};
  const frequency = evt.frequency || {};
  const existingLabel = evt.label || {};

  // Use the existing labeler verdict as the primary signal when available
  const verdict = existingLabel.verdict || null;

  const presentPct = survival.content_present_pct != null ? survival.content_present_pct : null;
  const untouchedSeconds = survival.untouched_seconds != null ? survival.untouched_seconds : null;
  const untouchedDays = untouchedSeconds != null ? untouchedSeconds / 86400 : null;
  const ageHours = (Date.now() - new Date(evt.ts || Date.now()).getTime()) / 3_600_000;
  const ageDays = ageHours / 24;

  // Override daysSinceShip if provided (for testing)
  const effectiveDays = daysSinceShip != null ? daysSinceShip : (untouchedDays != null ? untouchedDays : ageDays);

  // unknown — too new to score
  if (ageHours < 24 || verdict === 'in_progress') {
    return { label: 'unknown', score: 0, reason: 'event age < 24h, cannot score yet' };
  }

  // bad — churn signal from labeler or high edit frequency + poor survival
  if (verdict === 'churn') {
    const churnRatio = (frequency.edits_prev_1h || 0) / Math.max(ageHours, 1);
    const score = Math.max(0, 0.35 - churnRatio * 0.1);
    return {
      label: 'bad',
      score: Math.min(0.39, score),
      reason: existingLabel.reason || `churn verdict from labeler`,
    };
  }

  // bad — poor survival (< 30% content present after 7d)
  if (presentPct != null && presentPct < 30 && effectiveDays >= 7) {
    return {
      label: 'bad',
      score: Math.min(0.39, presentPct / 100),
      reason: `${presentPct}% content survived after ${effectiveDays.toFixed(1)}d (threshold <30%)`,
    };
  }

  // good — survived ≥ 7 days untouched + high presence
  if (
    (verdict === 'good') ||
    (presentPct != null && presentPct >= 80 && effectiveDays >= 7 && survival.in_head)
  ) {
    const score = Math.min(1.0, 0.80 + (presentPct || 80) / 500);
    return {
      label: 'good',
      score,
      reason: existingLabel.reason || `${presentPct || '?'}% survived, ${effectiveDays.toFixed(1)}d untouched`,
    };
  }

  // mid — shipped, edited within 7d, not reverted
  if (presentPct != null && presentPct >= 50) {
    const score = 0.40 + (presentPct - 50) / 200; // 0.40..0.65
    return {
      label: 'mid',
      score: Math.min(0.79, score),
      reason: `${presentPct}% content present, ${effectiveDays.toFixed(1)}d since ship`,
    };
  }

  // neutral / unknown — not enough signal
  return {
    label: 'unknown',
    score: 0,
    reason: existingLabel.reason || 'insufficient signal',
  };
}

// ──────────────────────────────────────────────
// Tuple construction
// ──────────────────────────────────────────────

/** Build a human-readable system prompt for the training tuple. */
function buildSystemPrompt(evt) {
  const runtime = (evt.runtime && evt.runtime.id) || 'unknown-runtime';
  const model = (evt.runtime && evt.runtime.model_id) || 'unknown-model';
  const skill = (evt.task && evt.task.skill) || null;
  const phase = (evt.task && evt.task.phase) || (evt.handoff && evt.handoff.phase) || null;

  const lines = [
    `You are a software engineering assistant (${runtime}, model=${model}).`,
    `Your task is to make precise, minimal code edits that solve the stated goal.`,
  ];
  if (skill) lines.push(`Skill context: ${skill}.`);
  if (phase) lines.push(`Phase: ${phase}.`);
  lines.push('Apply changes only to the specified file. Preserve existing style and conventions.');
  return lines.join('\n');
}

/** Build the user prompt for the training tuple. */
function buildUserPrompt(evt) {
  const filePath = evt.file_path || 'unknown';
  const diff = evt.diff || {};
  const taskId = (evt.task && evt.task.id) || (evt.handoff && evt.handoff.task_id) || null;

  const lines = [];
  if (taskId) lines.push(`Task: ${taskId}`);
  lines.push(`File: ${filePath}`);

  if (diff.kind === 'edit') {
    lines.push('\nApply this edit:');
    if (diff.old_string) {
      lines.push('<<<old>>>');
      lines.push(diff.old_string);
      lines.push('<<<new>>>');
    }
  } else if (diff.kind === 'write') {
    lines.push('\nWrite file with the following content:');
  } else if (diff.kind === 'multiedit') {
    const edits = Array.isArray(diff.edits) ? diff.edits : [];
    lines.push(`\nApply ${edits.length} edit(s) to the file.`);
  } else if (diff.kind === 'notebook') {
    lines.push('\nUpdate notebook cell:');
    if (diff.old_source) {
      lines.push('<<<old>>>');
      lines.push(diff.old_source);
      lines.push('<<<new>>>');
    }
  }

  return lines.join('\n');
}

/** Build the assistant response (the actual code output). */
function buildAssistantResponse(evt) {
  const diff = evt.diff || {};

  if (diff.kind === 'edit') {
    return diff.new_string || '';
  }
  if (diff.kind === 'write') {
    return diff.content || '';
  }
  if (diff.kind === 'multiedit') {
    const edits = Array.isArray(diff.edits) ? diff.edits : [];
    return edits.map((e, i) =>
      `# Edit ${i + 1}\n<<<old>>>\n${e.old_string || ''}\n<<<new>>>\n${e.new_string || ''}`
    ).join('\n\n');
  }
  if (diff.kind === 'notebook') {
    return diff.cell_source || '';
  }
  return '';
}

/** Build tool_calls representation from the event tool name + inputs. */
function buildToolCalls(evt) {
  if (!evt.tool) return undefined;
  return [{
    id: evt.event_id || null,
    name: evt.tool,
    input: {
      file_path: evt.file_path,
      ...(evt.diff && evt.diff.kind === 'edit' ? {
        old_string: evt.diff.old_string,
        new_string: evt.diff.new_string,
        replace_all: evt.diff.replace_all,
      } : {}),
      ...(evt.diff && evt.diff.kind === 'write' ? {
        content: evt.diff.content,
      } : {}),
    },
  }];
}

/**
 * Convert one enriched+labeled provenance event into an SFT training tuple.
 *
 * @param {object} joinedEvent — enriched event from joiner (with label/survival/frequency)
 * @param {{ label: string, score: number, reason: string }} qualityScore — from scoreQuality()
 * @returns {object} SFT tuple
 */
function buildSftTuple(joinedEvent, qualityScore) {
  const evt = joinedEvent;
  const taskType = classifyTaskType(evt);
  const toolCalls = buildToolCalls(evt);
  const assistantResponse = buildAssistantResponse(evt);

  const tuple = {
    system_prompt: buildSystemPrompt(evt),
    user_prompt: buildUserPrompt(evt),
    assistant_response: assistantResponse,
    meta: {
      runtime: (evt.runtime && evt.runtime.id) || null,
      model: (evt.runtime && evt.runtime.model_id) || null,
      handoff_id: (evt.handoff && evt.handoff.id) || null,
      task_id: (evt.task && evt.task.id) || (evt.handoff && evt.handoff.task_id) || null,
      phase: (evt.task && evt.task.phase) || (evt.handoff && evt.handoff.phase) || null,
      label: qualityScore.label,
      quality: Math.round((qualityScore.score || 0) * 1000) / 1000,
      quality_reason: qualityScore.reason || '',
      task_type: taskType,
      event_id: evt.event_id || null,
      file_path: evt.file_path || null,
      ts: evt.ts || null,
      tool: evt.tool || null,
    },
  };

  if (toolCalls) tuple.tool_calls = toolCalls;

  return tuple;
}

// ──────────────────────────────────────────────
// Main export pipeline
// ──────────────────────────────────────────────

/**
 * Run the full SFT export pipeline:
 *   1. Optionally re-run joiner+labeler (if --build flag set)
 *   2. Read enriched events from .planning/.provenance/
 *   3. Score each event + convert to SFT tuple
 *   4. Write to <outDir>/<runtime>/<task-type>/<date>.jsonl
 *
 * @param {object} opts
 * @param {string} opts.projectRoot  — repo root (used to find .planning/)
 * @param {string} [opts.planningDir] — override .planning path
 * @param {string} [opts.since]       — ISO date filter start
 * @param {string} [opts.until]       — ISO date filter end
 * @param {string} opts.outDir        — output root
 * @param {string} [opts.projectid]   — filter to specific project
 * @param {boolean} [opts.rebuild]    — if true, re-run joiner+labeler first
 * @param {object} [opts.config]      — gad config (for labeler)
 * @param {object[]} [opts.projects]  — multi-root config
 * @returns {{ tuples_written: number, files: object, total_bytes: number, skipped: number }}
 */
function exportSft({
  projectRoot,
  planningDir: planningDirOverride,
  since,
  until,
  outDir,
  projectid,
  rebuild,
  config,
  projects,
}) {
  const planningDir = planningDirOverride || path.join(projectRoot, '.planning');
  const traceJsonlPath = path.join(planningDir, '.trace-events.jsonl');

  // Optional rebuild pass
  if (rebuild) {
    if (fs.existsSync(traceJsonlPath)) {
      buildProvenance({ planningDir, traceJsonlPath, projects: projects || [], since, until });
    }
    const workerJoinMod = (() => {
      try { return require('./worker-join.cjs'); } catch (e) { return null; }
    })();
    if (workerJoinMod) {
      workerJoinMod.buildWorkerProvenance({ planningDir, since, until });
    }
    annotateSurvival({ planningDir, baseDir: projectRoot });
    annotateFrequency({ planningDir });
    annotateLabels({ planningDir, config: config || {} });
  }

  const dir = provenanceDir(planningDir);
  if (!fs.existsSync(dir)) {
    return { tuples_written: 0, files: {}, total_bytes: 0, skipped: 0 };
  }

  const { sinceDate, untilDate } = parseDateRange({ since, until });

  // Collect enriched events in date range
  const allFiles = fs.readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .sort();

  const filesMap = {};  // <runtime>/<task-type>/<date> -> tuples[]
  let tuplesWritten = 0;
  let skipped = 0;

  for (const f of allFiles) {
    const dateStr = f.replace(/\.jsonl$/, '');
    const fileDate = new Date(dateStr);
    if (fileDate < sinceDate || fileDate > untilDate) continue;

    for (const evt of readJsonl(path.join(dir, f))) {
      // Project filter
      if (projectid) {
        const evtProject = (evt.project && evt.project.id) || (evt.handoff && evt.handoff.projectid) || null;
        if (evtProject && evtProject !== projectid) {
          skipped++;
          continue;
        }
      }

      const quality = scoreQuality({ joinedEvent: evt });
      const tuple = buildSftTuple(evt, quality);

      // Skip if no meaningful assistant response
      if (!tuple.assistant_response || tuple.assistant_response.trim().length < 5) {
        skipped++;
        continue;
      }

      const runtime = (tuple.meta.runtime || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
      const taskType = tuple.meta.task_type || 'other';
      const bucketKey = `${runtime}/${taskType}/${dateStr}`;

      if (!filesMap[bucketKey]) filesMap[bucketKey] = [];
      filesMap[bucketKey].push(tuple);
      tuplesWritten++;
    }
  }

  // Write output files
  const outputFiles = {};
  let totalBytes = 0;

  for (const [bucketKey, tuples] of Object.entries(filesMap)) {
    const outPath = path.join(outDir, `${bucketKey}.jsonl`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const content = tuples.map((t) => JSON.stringify(t)).join('\n') + '\n';
    fs.writeFileSync(outPath, content, 'utf8');
    outputFiles[outPath] = tuples.length;
    totalBytes += Buffer.byteLength(content, 'utf8');
  }

  return {
    tuples_written: tuplesWritten,
    files: outputFiles,
    total_bytes: totalBytes,
    skipped,
  };
}

module.exports = {
  buildSftTuple,
  classifyTaskType,
  scoreQuality,
  exportSft,
};
