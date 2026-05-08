'use strict';
/**
 * lib/provenance/join.cjs — joiner: enrich trace events with full context.
 *
 * Reads .planning/.trace-events.jsonl, filters to code-producing tool calls
 * (Edit / Write / MultiEdit / NotebookEdit), and joins:
 *   - model_id from the same-session Stop-hook event (assistant_response)
 *   - handoff metadata (projectid, phase, task_id) from .planning/handoffs/
 *   - task metadata (skill, agent_id, runtime, phase) from .planning/tasks/
 *
 * Output: enriched events written to .planning/.provenance/YYYY-MM-DD.jsonl
 * (one file per event date), with this shape:
 *
 *   {
 *     event_id: "<seq>-<session_id>",
 *     ts: "...",
 *     tool: "Edit"|"Write"|"MultiEdit"|"NotebookEdit",
 *     file_path: "...",
 *     diff: { old_string, new_string } | { content } | { edits: [...] },
 *     runtime: { id, model_id, session_id },
 *     agent: { id, role, parent, root, depth, model_profile, resolved_model },
 *     handoff: { id, projectid, phase, task_id, claimed_by } | null,
 *     task: { id, phase, skill, agent_id, runtime } | null,
 *     project: { id, root_path } | null,
 *   }
 */

const fs = require('node:fs');
const path = require('node:path');
const { readJsonl, ymd, parseDateRange, provenanceFilePath, ensureProvenanceDir } = require('./index.cjs');

const CODE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * Build a session_id -> model_id map by scanning Stop-hook events
 * (these have populated runtime.model). Fallback for trace events
 * where runtime.model is null.
 */
function buildSessionModelMap(traceJsonlPath) {
  const map = new Map();
  for (const evt of readJsonl(traceJsonlPath)) {
    if (evt && evt.runtime && evt.runtime.session_id && evt.runtime.model) {
      map.set(evt.runtime.session_id, evt.runtime.model);
    }
  }
  return map;
}

/**
 * Parse YAML-ish frontmatter out of a handoff markdown file.
 * Returns { id, projectid, phase, task_id, claimed_by, claimed_at, completed_at, runtime_preference }.
 */
function parseHandoffFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const fm = {};
    for (const line of m[1].split(/\r?\n/)) {
      const eq = line.indexOf(':');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^['"](.+)['"]$/, '$1');
      fm[key] = val;
    }
    return fm;
  } catch (e) {
    return null;
  }
}

/**
 * Load all handoffs (open + claimed + closed) and index by claimed_by + active window.
 */
function loadHandoffs(planningDir) {
  const handoffs = [];
  for (const sub of ['open', 'claimed', 'closed']) {
    const dir = path.join(planningDir, 'handoffs', sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const fm = parseHandoffFrontmatter(path.join(dir, f));
      if (!fm) continue;
      fm._state = sub;
      fm._file = f;
      handoffs.push(fm);
    }
  }
  return handoffs;
}

/**
 * Find handoff matching a trace event by claimed_by + time window.
 * A trace event ts must fall between handoff.claimed_at and handoff.completed_at
 * (or now if open). claimed_by may be a session_id, runtime id, or worker id —
 * we match by substring overlap with the event's session_id.
 */
function findMatchingHandoff(handoffs, sessionId, eventTs) {
  const tsMs = new Date(eventTs).getTime();
  const candidates = handoffs.filter((h) => {
    if (!h.claimed_at) return false;
    const claimMs = new Date(h.claimed_at).getTime();
    if (tsMs < claimMs) return false;
    const endMs = h.completed_at ? new Date(h.completed_at).getTime() : tsMs + 1;
    if (tsMs > endMs) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  // Prefer one whose claimed_by matches session_id (substring or exact)
  if (sessionId) {
    const exact = candidates.find((h) => h.claimed_by && (h.claimed_by === sessionId || sessionId.includes(h.claimed_by) || (h.claimed_by || '').includes(sessionId)));
    if (exact) return exact;
  }
  // Otherwise return narrowest window
  candidates.sort((a, b) => {
    const aw = (new Date(a.completed_at || Date.now()).getTime() - new Date(a.claimed_at).getTime());
    const bw = (new Date(b.completed_at || Date.now()).getTime() - new Date(b.claimed_at).getTime());
    return aw - bw;
  });
  return candidates[0];
}

/**
 * Load task metadata by id.
 */
function loadTaskById(planningDir, taskId) {
  if (!taskId) return null;
  const safe = String(taskId).replace(/[^A-Za-z0-9._-]/g, '_');
  const tryPaths = [
    path.join(planningDir, 'tasks', `${safe}.json`),
    path.join(planningDir, 'tasks', `${taskId}.json`),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
      catch (e) { return null; }
    }
  }
  return null;
}

/**
 * Resolve which planning root a file_path falls under (for multi-root configs).
 */
function findOwningProject(filePath, projects) {
  if (!filePath || !projects || projects.length === 0) return null;
  const normalized = path.resolve(filePath);
  let best = null;
  for (const p of projects) {
    const root = path.resolve(p.rootPath);
    if (normalized.startsWith(root + path.sep) || normalized === root) {
      if (!best || root.length > best.rootPath.length) best = p;
    }
  }
  return best;
}

/**
 * Extract the diff payload from a trace event's inputs, normalized.
 */
function extractDiff(evt) {
  const inputs = evt.inputs || {};
  if (evt.tool === 'Edit') {
    return {
      kind: 'edit',
      old_string: inputs.old_string || '',
      new_string: inputs.new_string || '',
      replace_all: !!inputs.replace_all,
    };
  }
  if (evt.tool === 'Write') {
    return {
      kind: 'write',
      content: inputs.content || '',
    };
  }
  if (evt.tool === 'MultiEdit') {
    return {
      kind: 'multiedit',
      edits: inputs.edits || [],
    };
  }
  if (evt.tool === 'NotebookEdit') {
    return {
      kind: 'notebook',
      cell_source: inputs.cell_source || inputs.new_source || '',
      old_source: inputs.old_source || '',
      cell_id: inputs.cell_id || '',
    };
  }
  return null;
}

/**
 * Main joiner. Reads trace events, enriches with handoff+task+model context,
 * writes per-day enriched JSONL files in .planning/.provenance/.
 *
 * Returns a summary { events_total, events_kept, files_written, by_date }.
 */
/**
 * Yield events from both the live .trace-events.jsonl and the per-day
 * .trace-archive/*.jsonl files. De-dupes by (seq, session_id) since the
 * live stream is a rolling window that overlaps the most-recent archive.
 */
function* readAllTraceEvents(planningDir, traceJsonlPath) {
  const seen = new Set();
  const archiveDir = path.join(planningDir, '.trace-archive');
  if (fs.existsSync(archiveDir)) {
    const files = fs.readdirSync(archiveDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
    for (const f of files) {
      for (const evt of readJsonl(path.join(archiveDir, f))) {
        const key = `${evt.seq || ''}:${(evt.runtime && evt.runtime.session_id) || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        yield evt;
      }
    }
  }
  if (fs.existsSync(traceJsonlPath)) {
    for (const evt of readJsonl(traceJsonlPath)) {
      const key = `${evt.seq || ''}:${(evt.runtime && evt.runtime.session_id) || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      yield evt;
    }
  }
}

function buildProvenance({ planningDir, traceJsonlPath, projects, since, until }) {
  ensureProvenanceDir(planningDir);

  const { sinceDate, untilDate } = parseDateRange({ since, until });

  // Build session->model map from BOTH live + archive (Stop hook events
  // populate runtime.model on assistant_response messages).
  const sessionModel = new Map();
  for (const evt of readAllTraceEvents(planningDir, traceJsonlPath)) {
    if (evt && evt.runtime && evt.runtime.session_id && evt.runtime.model) {
      sessionModel.set(evt.runtime.session_id, evt.runtime.model);
    }
  }

  const handoffs = loadHandoffs(planningDir);

  const byDate = new Map();
  let total = 0;
  let kept = 0;

  for (const evt of readAllTraceEvents(planningDir, traceJsonlPath)) {
    total++;
    if (!evt.tool || !CODE_TOOLS.has(evt.tool)) continue;
    if (!evt.ts) continue;
    const evtDate = new Date(evt.ts);
    if (evtDate < sinceDate || evtDate > untilDate) continue;

    const sessionId = (evt.runtime && evt.runtime.session_id) || null;
    const filePath = evt.inputs && evt.inputs.file_path;
    const diff = extractDiff(evt);
    if (!diff || !filePath) continue;

    const handoff = findMatchingHandoff(handoffs, sessionId, evt.ts);
    const task = handoff ? loadTaskById(planningDir, handoff.task_id) : null;
    const project = findOwningProject(filePath, projects);

    const modelId = (evt.runtime && evt.runtime.model) || sessionModel.get(sessionId) || null;

    // Propagate trigger_skill from the trace event into the provenance envelope.
    // The trace hook emits either:
    //   - a richer object { id, kind, depth, started_ts }  (from active-skill-stack, post phase-153 wiring)
    //   - a plain string (legacy flat skill name, pre-stack)
    //   - null / absent (no active skill)
    // Normalise to object | null so the provenance consumer always gets the
    // same shape. slm-learning's skill_pressure_correlation.py reads .id.
    let triggerSkill = null;
    const rawSkill = evt.trigger_skill;
    if (rawSkill && typeof rawSkill === 'object' && rawSkill.id) {
      // Already the rich struct — pass through verbatim.
      triggerSkill = {
        id: rawSkill.id,
        kind: rawSkill.kind || 'skill_tool',
        depth: typeof rawSkill.depth === 'number' ? rawSkill.depth : 1,
        started_ts: rawSkill.started_ts || null,
      };
    } else if (typeof rawSkill === 'string' && rawSkill.trim()) {
      // Legacy flat string — upcast to minimal struct.
      triggerSkill = {
        id: rawSkill.trim(),
        kind: 'skill_tool',
        depth: 1,
        started_ts: null,
      };
    }
    // null → omit the field from the output object entirely (spec §2: "omit when no skill active")

    const enriched = {
      event_id: `${evt.seq || ''}-${sessionId || ''}`,
      ts: evt.ts,
      seq: evt.seq || null,
      tool: evt.tool,
      file_path: filePath,
      diff,
      runtime: {
        id: (evt.runtime && evt.runtime.id) || null,
        model_id: modelId,
        session_id: sessionId,
        source: (evt.runtime && evt.runtime.source) || null,
      },
      agent: {
        id: (evt.agent && evt.agent.agent_id) || null,
        role: (evt.agent && evt.agent.agent_role) || null,
        parent: (evt.agent && evt.agent.parent_agent_id) || null,
        root: (evt.agent && evt.agent.root_agent_id) || null,
        depth: (evt.agent && evt.agent.depth) || null,
        model_profile: (evt.agent && evt.agent.model_profile) || null,
        resolved_model: (evt.agent && evt.agent.resolved_model) || null,
      },
      handoff: handoff ? {
        id: handoff.id || null,
        projectid: handoff.projectid || null,
        phase: handoff.phase || null,
        task_id: handoff.task_id || null,
        claimed_by: handoff.claimed_by || null,
        runtime_preference: handoff.runtime_preference || null,
      } : null,
      task: task ? {
        id: task.id,
        phase: task.phase,
        skill: task.skill || null,
        agent_id: task.agent_id || null,
        runtime: task.runtime || null,
      } : null,
      project: project ? {
        id: project.projectId || null,
        root_path: project.rootPath || null,
      } : null,
    };

    // Attach trigger_skill only when present (spec §2: never write null).
    if (triggerSkill !== null) {
      enriched.trigger_skill = triggerSkill;
    }

    const dateKey = ymd(evtDate);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(enriched);
    kept++;
  }

  let filesWritten = 0;
  const byDateSummary = {};
  for (const [dateKey, events] of byDate.entries()) {
    const outPath = provenanceFilePath(planningDir, dateKey);
    // Replace per-day file (idempotent rebuild). If we wanted append-only,
    // we'd need to dedupe by event_id first.
    fs.writeFileSync(outPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    filesWritten++;
    byDateSummary[dateKey] = events.length;
  }

  return {
    events_total: total,
    events_kept: kept,
    files_written: filesWritten,
    by_date: byDateSummary,
  };
}

module.exports = {
  buildProvenance,
  CODE_TOOLS,
  parseHandoffFrontmatter,
  findMatchingHandoff,
};
