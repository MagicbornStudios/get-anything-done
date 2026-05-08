'use strict';
/**
 * lib/session-telemetry/adapters/claude-code.cjs
 *
 * Adapter that translates raw events written by scripts/claude-session-emit.cjs
 * into normalised session-telemetry event records suitable for
 * appendTelemetryEvent().
 *
 * The source hook writes events to:
 *   .planning/.sessions/<sessionId>/events.jsonl
 *
 * Each raw event has the shape:
 *   { ts, kind, session_id, schema_version, ...kindSpecificFields }
 *
 * Hook kinds emitted by claude-session-emit.cjs:
 *   session-start   — hook opened a new session
 *   session-end     — hook detected SessionEnd
 *   step-start      — PreToolUse opened a step
 *   step-end        — PostToolUse / PostToolUseFailure closed a step
 *   tool-call       — PostToolUse / PostToolUseFailure tool summary
 *   pressure-event  — hook detected a failure/deviation signal
 *   attribution-link — gad CLI attribution stamp detected in a command
 *
 * Mapping to telemetry kinds (VALID_KINDS):
 *   session-start   → task-start   (we treat a session as a task boundary for now)
 *   session-end     → task-end
 *   tool-call       → tool-call
 *   pressure-event  → retry        (when category=retry) | rate-limit (when category=rate-limit)
 *   step-start      → step
 *   step-end        → (dropped — already captured in tool-call)
 *   attribution-link → (dropped — not a telemetry event)
 *
 * Export:
 *   adaptClaudeCodeEmit(rawEmit) → TelemetryEvent[]
 *
 * where rawEmit is a single parsed JSON line from events.jsonl (or an array).
 */

const RUNTIME = 'claude-code';

/**
 * Translate a single raw emit event (or array of events) into an array of
 * telemetry event objects. The returned objects are ready for appendTelemetryEvent
 * (minus the projectRoot resolution — caller handles that).
 *
 * @param {object|object[]} rawEmit — one or many parsed JSON records from events.jsonl
 * @returns {Array<{sessionId, runtime, kind, payload, ts}>}
 */
function adaptClaudeCodeEmit(rawEmit) {
  const inputs = Array.isArray(rawEmit) ? rawEmit : [rawEmit];
  const out = [];

  for (const raw of inputs) {
    if (!raw || typeof raw !== 'object') continue;

    const sessionId = String(raw.session_id || '').trim();
    const ts = raw.ts || new Date().toISOString();

    if (!sessionId) continue;

    switch (raw.kind) {
      case 'session-start':
        out.push({
          sessionId,
          runtime: RUNTIME,
          kind: 'task-start',
          ts,
          payload: {
            intent: raw.intent || null,
            projectid: raw.projectid || null,
            model_profile: raw.model_profile || null,
            agent_id: raw.agent_id || null,
            claimed_handoff: raw.claimed_handoff || null,
            source: 'session-start',
          },
        });
        break;

      case 'session-end':
        out.push({
          sessionId,
          runtime: RUNTIME,
          kind: 'task-end',
          ts,
          payload: {
            outcome: raw.outcome || 'completed',
            total_steps: raw.total_steps || 0,
            total_retries: raw.total_retries || 0,
            durable_artifacts: Array.isArray(raw.durable_artifacts) ? raw.durable_artifacts : [],
            auto_compact_count: raw.auto_compact_count || 0,
            source: 'session-end',
          },
        });
        break;

      case 'tool-call':
        out.push({
          sessionId,
          runtime: RUNTIME,
          kind: 'tool-call',
          ts,
          payload: {
            tool: raw.tool || null,
            target: raw.target || null,
            ok: raw.ok !== undefined ? raw.ok : true,
            duration_ms: raw.duration_ms || 0,
            step_id: raw.step_id || null,
            output_excerpt: raw.output_excerpt || null,
          },
        });
        break;

      case 'step-start':
        out.push({
          sessionId,
          runtime: RUNTIME,
          kind: 'step',
          ts,
          payload: {
            step_id: raw.step_id || null,
            label: raw.label || null,
            parent_step: raw.parent_step || null,
            phase: 'start',
          },
        });
        break;

      case 'pressure-event': {
        // Map to retry or rate-limit based on category
        const category = String(raw.category || '').toLowerCase();
        let telemetryKind;
        if (category === 'rate-limit') {
          telemetryKind = 'rate-limit';
        } else if (category === 'retry') {
          telemetryKind = 'retry';
        } else {
          // file-modified, hook-block, tool-error, deviation → retry (pressure)
          telemetryKind = 'retry';
        }
        out.push({
          sessionId,
          runtime: RUNTIME,
          kind: telemetryKind,
          ts,
          payload: {
            category: raw.category || null,
            weight: raw.weight || 1,
            context: raw.context || null,
            step_id: raw.step_id || null,
          },
        });
        break;
      }

      // step-end and attribution-link are intentionally dropped — they don't
      // carry additional signal beyond tool-call / task-end already captures.
      case 'step-end':
      case 'attribution-link':
        break;

      default:
        // Unknown kind — forward as context-compact if it looks like a compaction
        // signal; otherwise drop.
        if (raw.kind && String(raw.kind).includes('compact')) {
          out.push({
            sessionId,
            runtime: RUNTIME,
            kind: 'context-compact',
            ts,
            payload: { original_kind: raw.kind },
          });
        }
        break;
    }
  }

  return out;
}

module.exports = { adaptClaudeCodeEmit };
