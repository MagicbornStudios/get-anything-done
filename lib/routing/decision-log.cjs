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

module.exports = { logRoutingDecision, updateRoutingOutcome, decisionLogPath };
