/**
 * Trace schema v4 — event types emitted by the GAD trace hook handler.
 *
 * Each line of .planning/.trace-events.jsonl is a single event object
 * conforming to one of the TraceEvent types defined here. Events are written
 * synchronously by bin/gad-trace-hook.cjs in response to Claude Code PreToolUse
 * and PostToolUse hooks (and, in milestone B of phase 25, skill / subagent /
 * file-mutation events as well).
 *
 * Post-run, gad eval preserve reads the JSONL, derives the aggregate v3
 * fields (skill_accuracy.expected_triggers, etc), and merges both raw events
 * and aggregates into TRACE.json with trace_schema_version: 4.
 *
 * Referenced by phase 25 plan (25-01) and decisions gad-50, gad-53, gad-58.
 */

'use strict';

const TRACE_SCHEMA_VERSION = 5;

/**
 * Event envelope shared by every trace event:
 *   {
 *     ts: ISO8601 string,
 *     seq: monotonic integer per run,
 *     type: 'tool_use' | 'skill_invocation' | 'subagent_spawn' | 'file_mutation',
 *     ...type-specific fields
 *   }
 */

const EVENT_TYPES = Object.freeze({
  TOOL_USE: 'tool_use',
  SKILL_INVOCATION: 'skill_invocation',
  SUBAGENT_SPAWN: 'subagent_spawn',
  FILE_MUTATION: 'file_mutation',
});

function makeRuntimeEnvelope(runtime) {
  return {
    id: runtime?.id ?? 'unknown',
    source: runtime?.source ?? 'unknown',
    model: runtime?.model ?? null,
    session_id: runtime?.session_id ?? null,
  };
}

/**
 * tool_use event — one per PostToolUse hook invocation.
 * {
 *   ts, seq, type: 'tool_use',
 *   tool: 'Read' | 'Write' | 'Edit' | 'Bash' | 'Grep' | 'Glob' | 'Task' | etc,
 *   inputs: <opaque object passed to the tool, truncated via trace-truncate>,
 *   outputs: <stringified output, truncated via trace-truncate, 4 KB cap>,
 *   outputs_truncated: boolean,
 *   duration_ms: number | null,
 *   success: boolean,
 *   trigger_skill: string | null   // from .planning/.trace-active-skill
 * }
 */
function makeToolUseEvent({ seq, runtime, tool, inputs, outputs, outputsTruncated, durationMs, success, triggerSkill }) {
  return {
    ts: new Date().toISOString(),
    seq,
    type: EVENT_TYPES.TOOL_USE,
    runtime: makeRuntimeEnvelope(runtime),
    tool,
    inputs: inputs ?? null,
    outputs: outputs ?? null,
    outputs_truncated: Boolean(outputsTruncated),
    duration_ms: durationMs ?? null,
    success: Boolean(success),
    trigger_skill: triggerSkill ?? null,
  };
}

/**
 * skill_invocation event — emitted when .planning/.trace-active-skill content
 * changes. Records the transition (from one skill to another, or from none).
 * {
 *   ts, seq, type: 'skill_invocation',
 *   skill_id: string,
 *   parent: string | null,            // previously-active skill, if any
 *   trigger_context: 'marker_file',   // for milestone B, only source is the marker
 *   trigger_snippet: null             // reserved for future richer context
 * }
 */
function makeSkillInvocationEvent({ seq, runtime, skillId, parent, triggerContext, triggerSnippet }) {
  return {
    ts: new Date().toISOString(),
    seq,
    type: EVENT_TYPES.SKILL_INVOCATION,
    runtime: makeRuntimeEnvelope(runtime),
    skill_id: skillId,
    parent: parent ?? null,
    trigger_context: triggerContext ?? 'marker_file',
    trigger_snippet: triggerSnippet ?? null,
  };
}

/**
 * subagent_spawn event — emitted when PostToolUse detects a Task tool call.
 * {
 *   ts, seq, type: 'subagent_spawn',
 *   agent_id: string,              // e.g. 'gad-planner'
 *   inputs: <truncated task prompt>,
 *   outputs: <truncated result summary>,
 *   duration_ms: number | null,
 *   success: boolean
 * }
 */
function makeSubagentSpawnEvent({ seq, runtime, agentId, inputs, outputs, durationMs, success }) {
  return {
    ts: new Date().toISOString(),
    seq,
    type: EVENT_TYPES.SUBAGENT_SPAWN,
    runtime: makeRuntimeEnvelope(runtime),
    agent_id: agentId,
    inputs: inputs ?? null,
    outputs: outputs ?? null,
    duration_ms: durationMs ?? null,
    success: Boolean(success),
  };
}

/**
 * file_mutation event — emitted when PostToolUse detects a Write / Edit /
 * NotebookEdit tool call.
 * {
 *   ts, seq, type: 'file_mutation',
 *   path: string,                  // absolute or project-relative
 *   op: 'create' | 'edit' | 'delete',
 *   size_delta: number | null,     // bytes added (positive) or removed (negative)
 * }
 */
function makeFileMutationEvent({ seq, runtime, filePath, op, sizeDelta }) {
  return {
    ts: new Date().toISOString(),
    seq,
    type: EVENT_TYPES.FILE_MUTATION,
    runtime: makeRuntimeEnvelope(runtime),
    path: filePath,
    op,
    size_delta: sizeDelta ?? null,
  };
}

/**
 * Type guard. Returns true if value is a valid trace event envelope with a
 * known type. Used by the preserver to validate JSONL lines before merging.
 */
function isTraceEvent(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.ts !== 'string') return false;
  if (typeof value.seq !== 'number') return false;
  if (typeof value.type !== 'string') return false;
  return Object.values(EVENT_TYPES).includes(value.type);
}

/**
 * Parse a JSONL file into an array of validated events. Invalid lines are
 * skipped with a warning on stderr (not thrown — a partial trace is still
 * more useful than no trace).
 */
function parseTraceEventsJsonl(content) {
  const lines = content.split('\n');
  const events = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (isTraceEvent(obj)) {
        events.push(obj);
      } else {
        process.stderr.write(`trace-schema: skipping invalid event at line ${i + 1}\n`);
      }
    } catch (err) {
      process.stderr.write(`trace-schema: skipping unparseable line ${i + 1}: ${err.message}\n`);
    }
  }
  return events;
}

module.exports = {
  TRACE_SCHEMA_VERSION,
  EVENT_TYPES,
  makeRuntimeEnvelope,
  makeToolUseEvent,
  makeSkillInvocationEvent,
  makeSubagentSpawnEvent,
  makeFileMutationEvent,
  isTraceEvent,
  parseTraceEventsJsonl,
};
