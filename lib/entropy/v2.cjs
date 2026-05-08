'use strict';
/**
 * lib/entropy/v2.cjs — Skill Entropy v2 with decomposition-diversity dimension.
 *
 * Phase 89: Extends lib/entropy/compute.cjs (v1) without breaking it.
 *
 * New dimension: Decomposition Diversity
 *   Measures how varied the tool-call sequences are across observed sessions.
 *   A system that always uses the same sequence of tools is "stuck in a rut"
 *   (low diversity = lower entropy ceiling). A system that explores a wide
 *   variety of sequences is more capable / higher entropy.
 *
 *   diversity = unique_tool_call_sequences / total_sequences
 *   (clamped to 0-1; undefined / 0 when no sessions observed)
 *
 * computeEntropyV2({ projectRoot, since }) returns:
 *   {
 *     v1: <existing computePressure output>,
 *     v2: {
 *       score:                   0-1 (weighted blend of v1 + diversity),
 *       decomposition_diversity: 0-1,
 *       unique_sequences:        N,
 *       total_sequences:         N,
 *       diversity_source:        'telemetry' | 'none',
 *     }
 *   }
 *
 * The v2 score blends v1.score (pressure) with decomposition diversity.
 * Higher diversity → slightly lower pressure score (more skill available).
 * Weight: v2.score = v1.score * 0.7 + diversity * 0.3
 * Rationale: diversity is an entropy-increasing signal but pressure is the
 * primary pain signal; diversity dampens it rather than overriding it.
 */

const path = require('path');
const fs = require('fs');
const { computePressure } = require('./compute.cjs');

// ── helpers ──────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function parseSinceMs(since) {
  if (!since) return null;
  const daysMatch = String(since).match(/^(\d+)d$/i);
  if (daysMatch) return Date.now() - Number(daysMatch[1]) * 86400_000;
  const ts = Date.parse(since);
  return Number.isFinite(ts) ? ts : null;
}

function readJsonlFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Collect all telemetry events from .planning/sessions/*.telemetry.jsonl,
 * optionally filtered to events after sinceMs.
 *
 * @param {string} projectRoot
 * @param {number|null} sinceMs
 * @returns {object[]}
 */
function collectTelemetryEvents(projectRoot, sinceMs) {
  const dir = path.join(projectRoot, '.planning', 'sessions');
  if (!fs.existsSync(dir)) return [];

  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.telemetry.jsonl'));
  } catch {
    return [];
  }

  const events = [];
  for (const fname of files) {
    const raw = readJsonlFile(path.join(dir, fname));
    for (const e of raw) {
      if (!e || typeof e !== 'object') continue;
      if (sinceMs) {
        const t = Date.parse(e.ts);
        if (!Number.isFinite(t) || t < sinceMs) continue;
      }
      events.push(e);
    }
  }
  return events;
}

/**
 * Build tool-call sequences per task boundary (task-start → task-end).
 * Returns an array of sequences, where each sequence is a comma-joined string
 * of tool names (for easy de-duplication).
 *
 * @param {object[]} events
 * @returns {string[]}
 */
function buildSequences(events) {
  const sequences = [];
  let currentSeq = null;

  for (const e of events) {
    switch (e.kind) {
      case 'task-start':
        currentSeq = [];
        break;
      case 'tool-call':
        if (currentSeq !== null) {
          currentSeq.push(String(e.tool || 'unknown'));
        }
        break;
      case 'task-end':
        if (currentSeq !== null && currentSeq.length > 0) {
          sequences.push(currentSeq.join(','));
        }
        currentSeq = null;
        break;
      default:
        break;
    }
  }

  // Close any open sequence at end of events
  if (currentSeq !== null && currentSeq.length > 0) {
    sequences.push(currentSeq.join(','));
  }

  return sequences;
}

/**
 * Compute decomposition diversity from telemetry sessions.
 *
 * @param {string} projectRoot
 * @param {string|null} since
 * @returns {{ diversity: number, unique_sequences: number, total_sequences: number, source: string }}
 */
function computeDecompositionDiversity(projectRoot, since) {
  const sinceMs = parseSinceMs(since);
  const events = collectTelemetryEvents(projectRoot, sinceMs);

  if (events.length === 0) {
    return { diversity: 0, unique_sequences: 0, total_sequences: 0, source: 'none' };
  }

  const sequences = buildSequences(events);
  const total = sequences.length;

  if (total === 0) {
    return { diversity: 0, unique_sequences: 0, total_sequences: 0, source: 'telemetry' };
  }

  const unique = new Set(sequences).size;
  const diversity = clamp(unique / total, 0, 1);

  return {
    diversity,
    unique_sequences: unique,
    total_sequences: total,
    source: 'telemetry',
  };
}

// ── computeEntropyV2 ──────────────────────────────────────────────────────────

/**
 * Compute Skill Entropy v2.
 *
 * Combines v1 pressure score with decomposition-diversity dimension.
 *
 * @param {object} opts
 * @param {string}  [opts.projectRoot] — defaults to process.cwd()
 * @param {string}  [opts.since]       — "7d", "30d", or "YYYY-MM-DD"
 * @param {string}  [opts.projectid]   — passed to v1 computePressure
 * @returns {{ v1: object, v2: object }}
 */
function computeEntropyV2({ projectRoot, since, projectid } = {}) {
  const root = projectRoot || process.cwd();
  const pid = projectid || 'unknown';

  // V1: existing pressure signal
  const v1 = computePressure(pid, { baseDir: root });

  // V2 decomposition diversity dimension
  const decomp = computeDecompositionDiversity(root, since || null);

  // Blend: diversity increases entropy (decreases pressure perception).
  // Weight: score = v1.score * 0.7 + (1 - diversity) * 0.3
  // Reasoning: diversity=1 means no pressure from skill gap; diversity=0
  // means full contribution from the absence of variety.
  const v2Score = clamp(v1.score * 0.7 + (1 - decomp.diversity) * 0.3, 0, 1);

  return {
    v1,
    v2: {
      score: Math.round(v2Score * 1000) / 1000,
      decomposition_diversity: Math.round(decomp.diversity * 1000) / 1000,
      unique_sequences: decomp.unique_sequences,
      total_sequences: decomp.total_sequences,
      diversity_source: decomp.source,
      since: since || null,
      generated_at: new Date().toISOString(),
    },
  };
}

module.exports = {
  computeEntropyV2,
  // Exported for tests:
  computeDecompositionDiversity,
  buildSequences,
  collectTelemetryEvents,
};
