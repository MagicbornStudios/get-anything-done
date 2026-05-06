'use strict';
// Routing decision logger — phase 140 foundation.
//
// Every routing decision (which runtime, which agent, which model) appends
// a structured row to `.planning/.gad-log/<date>-routing.jsonl`. After
// ~500 rows accumulate, the rule-engine outputs become labels for training
// the SVM/logistic router (phase 140 ML upgrade).
//
// Schema (locked 2026-05-06, operator directive):
//   ts                ISO-8601
//   task              short task description
//   task_shape        planning|test-repair|doc-verification|cli-translation|edit-feature|debug|research|other
//   chosen_runtime    claude-code|codex-cli|gemini-cli|opencode|local-slm
//   chosen_agent      slug of subagent (gad-doc-verifier, etc) or "none"
//   chosen_model      "frontier" | "local-slm:<slug>" | "default"
//   reason            string[] — rule names that fired
//   outcome           pending|success|failed|rate-limited|blocked
//   cost_estimate     USD float (rough), 0 if unknown
//   latency_ms        int, -1 if pending
//   project_id        gad project id
//   session_id        gad session id (if any)

const fs = require('fs');
const path = require('path');

function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function decisionLogPath(baseDir) {
  return path.join(baseDir, '.planning', '.gad-log', `${todayKey()}-routing.jsonl`);
}

function logRoutingDecision(baseDir, payload) {
  const required = ['task_shape', 'chosen_runtime', 'reason'];
  for (const k of required) {
    if (payload[k] === undefined || payload[k] === null) {
      throw new Error(`logRoutingDecision: missing required field '${k}'`);
    }
  }
  const row = {
    ts: new Date().toISOString(),
    task: payload.task || '',
    task_shape: payload.task_shape,
    chosen_runtime: payload.chosen_runtime,
    chosen_agent: payload.chosen_agent || 'none',
    chosen_model: payload.chosen_model || 'default',
    reason: Array.isArray(payload.reason) ? payload.reason : [String(payload.reason)],
    outcome: payload.outcome || 'pending',
    cost_estimate: typeof payload.cost_estimate === 'number' ? payload.cost_estimate : 0,
    latency_ms: typeof payload.latency_ms === 'number' ? payload.latency_ms : -1,
    project_id: payload.project_id || 'unknown',
    session_id: payload.session_id || '',
  };
  const fp = decisionLogPath(baseDir);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.appendFileSync(fp, JSON.stringify(row) + '\n');
  return row;
}

function updateRoutingOutcome(baseDir, ts, outcome, latencyMs) {
  // Future: streaming update by ts. For now, append a follow-up row with
  // matching ts + outcome=<final>. Decision-engine downstream collapses.
  const fp = decisionLogPath(baseDir);
  const followup = {
    ts: new Date().toISOString(),
    matches_ts: ts,
    outcome,
    latency_ms: typeof latencyMs === 'number' ? latencyMs : -1,
    kind: 'routing-outcome-update',
  };
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.appendFileSync(fp, JSON.stringify(followup) + '\n');
  return followup;
}

/**
 * Infer task_shape from handoff body keywords. Coarse heuristic — good
 * enough for v1 routing decisions; later phases (140 ML upgrade) train
 * a real classifier on accumulated rows.
 *
 * Categories match the schema's task_shape enum:
 *   planning | test-repair | doc-verification | cli-translation |
 *   edit-feature | debug | research | other
 */
function inferTaskShapeFromHandoffBody(body) {
  const text = String(body || '').toLowerCase().slice(0, 4096);
  if (!text) return 'other';
  if (/\b(test[s]?\s+fail|failing\s+test|broken\s+test|repair|fix\s+test)/.test(text)) return 'test-repair';
  if (/\b(verify\s+doc|verify\s+factual|doc[s]?\s+verifier|fact[- ]?check)/.test(text)) return 'doc-verification';
  if (/\b(translate\s+cli|cli\s+translation|migrate\s+cli)/.test(text)) return 'cli-translation';
  if (/\b(plan|planning|design|architecture|roadmap|propose|spec)/.test(text)) return 'planning';
  if (/\b(debug|crash|error|exception|stack\s*trace|investigate)/.test(text)) return 'debug';
  if (/\b(research|survey|audit|inventory|map\s+codebase)/.test(text)) return 'research';
  if (/\b(implement|edit|add|build|wire|create\s+a|new\s+(file|module|component))/.test(text)) return 'edit-feature';
  return 'other';
}

/**
 * Convenience: log a routing decision for a handoff claim. Wraps the
 * full schema with handoff-specific defaults, returns the row written.
 *
 * Phase 140 task: every handoff claim populates the routing decision
 * log so slm-learning can train a router from real decisions.
 */
function logHandoffClaim(baseDir, { handoffId, body, runtime, agent, projectId, sessionId, frontmatter }) {
  const fm = frontmatter || {};
  const reasonParts = ['handoff-claim'];
  if (fm.runtime_preference) reasonParts.push(`runtime_pref=${fm.runtime_preference}`);
  if (fm.priority) reasonParts.push(`priority=${fm.priority}`);
  if (fm.estimated_context) reasonParts.push(`ctx=${fm.estimated_context}`);
  return logRoutingDecision(baseDir, {
    task: handoffId,
    task_shape: inferTaskShapeFromHandoffBody(body),
    chosen_runtime: runtime || 'unknown',
    chosen_agent: agent || 'none',
    chosen_model: 'default',
    reason: reasonParts,
    outcome: 'pending',
    project_id: projectId || fm.projectid || 'unknown',
    session_id: sessionId || '',
  });
}

module.exports = {
  logRoutingDecision,
  updateRoutingOutcome,
  decisionLogPath,
  inferTaskShapeFromHandoffBody,
  logHandoffClaim,
};
